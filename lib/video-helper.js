var FHelper = require('./file-helper')
var GHelper = require('./general-helper')
var PHelper = require('./page-helper')
var fs = require('fs')

console.log("PHelper", PHelper)
console.log("VHelper", FHelper)

module.exports = function(client) {
  return {
    /**
    * input: complete file path to video file
    * output: returns true if it has not been uploaded, false if it has been
    */
    notUploaded: function(filePath, callback) {
      var stats = fs.statSync(filePath)

      this.changedSinceLastSync(stats, filePath, function(res) {
        return callback(res)
      })
    },

    /**
    * input: object of file stats, and it's complete file path
    * output: returns true if file has been modified and is new, false if not
    */
    changedSinceLastSync: function(stats, filePath, callback) {
      var self = this
      this.getLastSync(filePath, function(lastSync) {
        if(lastSync) {
          return callback(!(FHelper.isSameFile(stats, lastSync)))
        } else {
          return callback(true)
        }
      })
    },

    /**
    * input: file path to directory
    * output: if markdown found and vsync found return object, else false
    * side effect: create default markdown if it doesn't exist
    */
    getLastSync: function(filePath, callback) {
      PHelper.findMarkdownFile(filePath, function(mdFile, mdStr) {
        if(mdFile) {
          var vsync = PHelper.findKeyInMarkdown(mdStr, 'vsync')

          if(vsync) {
            var splitVsync = vsync.split('|')

            lastSync = {
              'birthtime': splitVsync[0],
              'size': splitVsync[1]
            }

            return callback(lastSync)
          } else {
            return callback(false)
          }
        } else {
          /**
          * Every page should have markdown file so create with default
          * access and id for front matter
          * page title for body
          */
          var splitArr = filePath.split('/')
          splitArr.pop()

          var pageTitle = splitArr[splitArr.length - 2]
          var mdFilePath =  splitArr.join('/') + '/page.md'

          PHelper.createDefaultMarkdown(mdFilePath, pageTitle, callback)
        }
      })
    },

    /**
    * input: name of video file
    * side effect: uploads video to s3 and adds its url to corresponding page
    */
    s3Upload: function(video, s3Data, sender, callback) {
      var fileName = FHelper.generateFileName(video)
      var s3Url = 'https://s3-' + s3Data.region + '.amazonaws.com/' + s3Data.bucket + '/'
      var s3Location = s3Data.commId + '/videos/' + fileName
      var videoUrl = s3Url + s3Location

      var params = {
        localFile: video,

        s3Params: {
          Bucket: s3Data.bucket,
          Key: s3Location
        }
      }

      var uploader = client.uploadFile(params)
      this.addUploadListeners(video, videoUrl, uploader, sender, callback)
    },

    /**
    * input: full path to video, video url, uploader, sender, callback
    * side effect: adds listeners to uploader object
    */
    addUploadListeners: function(video, videoUrl, uploader, sender, callback) {
      var normalFileName = FHelper.generateStatusFileName(video)

      uploader.on('error', function(err) {
        sender.send('update-status', { msg: err.stack })
      })

      uploader.on('progress', function() {
        var percentageComplete = (uploader.progressAmount/uploader.progressTotal * 100).toFixed(2)
        var progress = 'Uploading ' + normalFileName + ': ' + percentageComplete + '%'
        sender.send('update-status', { msg: progress })
      })

      uploader.on('end', function() {
        // Add to page new vsync
        PHelper.findMarkdownFile(video, function(mdFilePath, mdStr) {
          if(mdFilePath) {
            var stats = fs.statSync(video)

            var vsyncInfo = {
              vsync: +stats['birthtime'] + '|' + stats['size'],
              embed: videoUrl
            }

            var mdContent = PHelper.insertFrontMatter(mdStr, vsyncInfo)

            fs.writeFile(mdFilePath, mdContent, function (err) {
              if(err) {
                sender.send('update-status', { msg: err })
              } else {
                sender.send('update-status', { msg: 'Updated ' + FHelper.generateStatusFileName(mdFilePath) })
              }

              NM_VIDEO_COUNT++
              GHelper.checkIfDone(callback)
            })

          } else {
            NM_VIDEO_COUNT++
            GHelper.checkIfDone(callback)
          }
        })

        sender.send('update-status', { msg: 'Uploaded ' + normalFileName })
      })
    },

    /**
     * input: array file paths to videos, s3Data, sender, callback
     * output: triggers callback if done
     * side effect: uploads new videos to s3
     */
    uploadNewVideos: function(videos, s3Data, sender, callback) {
      var self = this
      videos.forEach(function(video) {
        self.notUploaded(video, function(res) {
          if(res) {
            self.s3Upload(video, s3Data, sender, callback)
          } else {
            NM_VIDEO_COUNT++
            GHelper.checkIfDone(callback)
          }
        })
      })
    },

    deleteUnusedVideos: function(pages, s3Data, client, sender, callback) {
      // check pages with vsync
      // if no corresponding video then erase from s3
      // remove vsync from the page
      pages.forEach(function(page) {
        console.log('PHelper', PHelper)
        PHelper.cleanUpUnusedVsyncAndEmbed(page, s3Data, client, sender, callback)
      })
    },

    isS3Link(url, s3Data){
      var s3Url = 'https://s3-' + s3Data.region +
                  '.amazonaws.com/' + s3Data.bucket + '/'

      return url.indexOf(s3Url !== -1)
    },

    removeVideo: function(s3Url, s3Data, client, sender) {
      var fileName = s3Url.substring(s3Url.lastIndexOf('/') + 1)

      console.log('s3Data', s3Data)
      console.log('fileName', fileName)
      var deleter = client.deleteObjects({
        Bucket: s3Data.bucket,
        Delete: { /* required */
          Objects: [ /* required */
            {
              Key: s3Data.commId + '/videos/' + fileName, /* required */
            }
          ]
        }
      })

      deleter.on('error', function(err) {
        sender.send('update-status', { msg: err })
      })

      deleter.on('progress', function() {
        var progressAmount = (deleter.progressAmount/deleter.progressTotal * 100).toFixed(2)

        if(!isNaN(progressAmount)) {
          var progress = 'Deleting ' + fileName + ': ' + progressAmount + '%'
          sender.send('update-status', { msg: progress })
        }
      })

      deleter.on('end', function() {
        sender.send('update-status', { msg: 'Done deleting ' + fileName })
      })
    }
  }
}
