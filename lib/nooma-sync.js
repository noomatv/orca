var dir = require('node-dir')
var fs = require('fs')
var uuid = require('uuid')
var GHelper = require('./general-helper')
var FHelper = require('./file-helper')
var PHelper = require('./page-helper')

module.exports = {
  startScript: function(dirname, s3Data, sender) {
    var self = this
    return self.prepareBooks(dirname, s3Data, sender, function() {
      return self.syncBooks(dirname, s3Data, sender)
    })
  },
  prepareBooks: function(dirname, s3Data, sender, callback) {
    var client = GHelper.createClient(s3Data)
    var VHelper = require('./video-helper')(client)

    dir.files(dirname, function(err, files) {
      if (err) throw err

      pages = FHelper.getFiles(files, 'md')
      videos = FHelper.getFiles(files, 'mp4')

      pages.forEach(function(page) {
        fs.readFile(page, 'utf-8', function(err, data) {
          if(!PHelper.findKeyInMarkdown(data, 'id')) {
            var mdContent = PHelper.insertFrontMatter(data, { id: uuid.v4() })

            fs.writeFile(page, mdContent, function (err) {
              if (err) {
                console.log(err)
              } else {
                console.log('done')
              }
              NM_PAGE_COUNT++
              GHelper.checkIfDone(callback)
            })
          } else {
            NM_PAGE_COUNT++
            GHelper.checkIfDone(callback)
          }
        })
      })

      videos.forEach(function(video) {
        VHelper.notUploaded(video, function(res) {
          if(res) {
            VHelper.s3Upload(video, s3Data, sender, callback)
          } else {
            NM_VIDEO_COUNT++
            GHelper.checkIfDone(callback)
          }
        })
      })
    })
  },
  syncBooks: function(dirname, s3Data, sender) {
    var client = GHelper.createClient(s3Data)

    var params = {
      localDir: dirname,
      deleteRemoved: true, // default false, whether to remove s3 objects
      // that have no corresponding local file.

      s3Params: {
        Bucket: s3Data.bucket,
        Prefix: s3Data.commId + "/books",
        // other options supported by putObject, except Body and ContentLength.
        // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
      },
    }

    var uploader = client.uploadDir(params);

    uploader.on('error', function(err) {
      console.error("unable to sync:", err.stack);
    })

    uploader.on('progress', function() {
      var progressAmount = (uploader.progressAmount/uploader.progressTotal * 100).toFixed(2)

      if(!isNaN(progressAmount)) {
        var progress = 'Syncing: ' + progressAmount + '%'
        sender.send('update-status', { msg: progress })
      }
    })

    uploader.on('end', function() {
      sender.send('update-status', { msg: 'Done syncing' })
    })
  }
}
