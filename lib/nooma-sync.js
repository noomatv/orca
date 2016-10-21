var dir = require('node-dir')
var fs = require('fs')
var uuid = require('uuid')
var GHelper = require('./general-helper')
var FHelper = require('./file-helper')
var PHelper = require('./page-helper')

module.exports = {
  /**
  * input: dirname, s3Data obj, sender from electron
  * output: returns true if successful, false if not
  * side effect: updates ui using sender argument regarding progress
  */
  startScript: function(dirname, s3Data, sender) {
    var self = this

    return self.prepareBooks(dirname, s3Data, sender, function() {
      return self.syncBooks(dirname, s3Data, sender)
    })
  },

  /**
  * input: dirname, s3Data obj, sender from electron
  * side effect: triggers callback once preparation is complete
  */
  prepareBooks: function(dirname, s3Data, sender, callback) {
    var client = GHelper.createClient(s3Data)
    var VHelper = require('./video-helper')(client)

    NM_PAGE_LENGTH = 0
    NM_VIDEO_LENGTH = 0
    NM_OTHER_PAGE_LENGTH = 0

    dir.files(dirname, function(err, files) {
      if (err) throw err

      pages = FHelper.getFiles(files, 'md')
      videos = FHelper.getFiles(files, 'mp4')

      NM_PAGE_LENGTH = pages.length
      NM_VIDEO_LENGTH = videos.length
      NM_OTHER_PAGE_LENGTH = NM_PAGE_LENGTH

      VHelper.deleteUnusedVideos(pages, s3Data, client, sender, callback)
      PHelper.addIdToPagesWithoutIt(pages, callback)
      VHelper.uploadNewVideos(videos, s3Data, sender, callback)
    })
  },

  /**
  * input: dirname, s3Data obj, sender from electron
  * output: returns true if successful else false
  * side effect: updates ui regarding status, syncs new/updated files to s3
  */
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
      return false
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
      return true
    })
  }
}
