var uuid = require('uuid')
var PHelper = require('./page-helper')
var FHelper = require('./file-helper')
var GHelper = require('./general-helper')
var fs = require('fs')

module.exports = function(client) {
  return {
    /**
    * input: complete file path to video file
    * output: returns true if it has not been uploaded, false if it has been
    */
    notUploaded : function(filePath, callback) {
      var stats = fs.statSync(filePath)

      changedSinceLastSync(stats, filePath, function(res) {
        return callback(res)
      })

      /**
      * input: object of file stats, and it's complete file path
      * output: returns true if file has been modified and is new, false if not
      */
      function changedSinceLastSync(stats, filePath, callback) {
        getLastSync(filePath, function(lastSync) {
          if(lastSync) {

            return callback(!((+stats['birthtime']).toString() === lastSync['birthtime'] &&
                              (stats['size']).toString() === lastSync['size']))

          } else {
            return callback(true)
          }
        })
      }

      /**
      * input: file path to directory
      * output: if markdown found and vsync found return object, else false
      * side effect: create default markdown if it doesn't exist
      */
      function getLastSync(filePath , callback) {
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
            * TODO: Move to a function
            */

            var defaultFrontMatter = {
              access: 'subscribers',
              id: uuid.v4()
            }

            var splitArr = filePath.split('/')
            splitArr.pop()
            var pageTitle = splitArr[splitArr.length - 2]

            PHelper.insertFrontMatter('# ' + pageTitle, defaultFrontMatter, function(mdStr) {
              var mdFilePath =  splitArr.join('/') + '/page.md'

              fs.writeFile(mdFilePath, mdStr, function (err) {
                if (err) {
                  console.log(err)

                } else {
                  // TODO: Send message back with sender
                  console.log('done')
                }

                return callback(false)
              })
            })
          }
        })
      }
    },

    /**
    * input: name of video file
    * side effect: uploads video to s3 and adds its url to corresponding page
    */
    s3Upload: function(video, s3Data, sender, callback) {
      var fileName = FHelper.generateFileName(video)
      var normalFileName = FHelper.generateStatusFileName(video)

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

            PHelper.insertFrontMatter(mdStr, vsyncInfo, function(newContent) {
              fs.writeFile(mdFilePath, newContent, function (err) {
                if (err) {
                  sender.send('update-status', { msg: err })
                } else {
                  sender.send('update-status', { msg: 'Updated ' + FHelper.generateStatusFileName(mdFilePath) })
                }
                NM_VIDEO_COUNT++
                GHelper.checkIfDone(callback)
              })
            })
          } else {
            NM_VIDEO_COUNT++
            GHelper.checkIfDone(callback)
          }
        })

        sender.send('update-status', { msg: 'Uploaded ' + normalFileName })
      })
    }
  }
}
