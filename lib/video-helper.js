const FHelper = require('./file-helper')
const GHelper = require('./general-helper')
const PHelper = require('./page-helper')
const fs = require('fs')
const uuid = require('uuid')

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

          var pageTitle = splitArr[splitArr.length - 1]
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
      var processId = uuid.v4()

      uploader.on('error', function(err) {
        sender.send('upload-error', { msg: err.stack })
      })

      uploader.on('progress', function() {
        var progress = (uploader.progressAmount/uploader.progressTotal * 100).toFixed(2)

        if(!isNaN(progress)) {
          var outgoing = {
            id: processId,
            name: normalFileName,
            progressAmount: uploader.progressAmount,
            progressTotal: uploader.progressTotal,
            progress: progress
          }

          sender.send('update-status', { msg: 'Uploading...' })
          sender.send('update-progress', outgoing)
        }
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
                sender.send('upload-error', { msg: err.stack })
              } else {
                console.log('Updated vsync for' + FHelper.generateStatusFileName(mdFilePath))
              }
              NM_VIDEO_COUNT++
              GHelper.checkIfDone(callback)
            })
          } else {
            NM_VIDEO_COUNT++
            GHelper.checkIfDone(callback)
          }
        })
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
    }
  }
}
