const dir = require('node-dir')
const fs = require('fs')
const uuid = require('uuid')
const path = require('path')
const rmdir = require('rimraf');

const GHelper = require('./general-helper')
const FHelper = require('./file-helper')
const PHelper = require('./page-helper')
const BHelper = require('./book-helper')

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

    // Reset previous counter if synced before
    NM_PAGE_LENGTH = 0
    NM_VIDEO_LENGTH = 0
    NM_OTHER_PAGE_LENGTH = 0

    dir.files(dirname, function(err, files) {
      if (err) throw err

      pages = FHelper.getFiles(files, 'md')
      videos = FHelper.getFiles(files, 'mp4')

      // Counter needed to not sync until all books are prepared
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
    FHelper.moveVideosToTempSyncing(dirname, function() {
      var books = BHelper.getDirectoryPathsOfAllBooks(dirname)

      console.log('books', books)

      BHelper.syncAllBooks(dirname, books, s3Data, client, sender, function() {
        FHelper.moveVideosBackFromTempSyncing(dirname, function() {
          rmdir(dirname + '/tmp', function(error) {
            console.log(error)
          });
        })
      })
    })
  }
}
