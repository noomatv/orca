const FHelper = require('./file-helper')
const path = require('path')

module.exports = {
  getDirectoryPathsOfAllBooks: function(dirname) {
    var allDirs = FHelper.getDirectories(dirname)

    return allDirs.filter(function(dir) {
      return dir !== 'tmp'
    }).map(function(dir) {
      return dirname + path.sep + dir
    })
  },

  syncAllBooks: function(dirname, books, s3Data, client, sender, callback) {
    var self = this
    var totalCount = books.length

    NM_BOOK_COUNT = 0
    books.forEach(function(book) {
      console.log('book', book)
      self.syncBook(dirname, book, totalCount, s3Data, sender, client, callback)
    })
  },

  syncBook: function(dirname, book, totalCount, s3Data, sender, client, callback) {
    // console.log('localDir', path.dirname(book).remove(dirname, ''))


    var prefixDir =  book.replace(path.dirname(book), '')

    var params = {
      localDir: book,
      deleteRemoved: true, // default false, whether to remove s3 objects
      // that have no corresponding local file.

      s3Params: {
        Bucket: s3Data.bucket,
        Prefix: s3Data.commId + '/books' + prefixDir,
        // other options supported by putObject, except Body and ContentLength.
        // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property
      }
    }

    var uploader = client.uploadDir(params);

    uploader.on('error', function(err) {
      console.error("unable to sync:", err.stack);


      NM_BOOK_COUNT++


      console.log('NM_BOOK_COUNT', NM_BOOK_COUNT)
      console.log('totalCount', totalCount)
      if(NM_BOOK_COUNT === totalCount) {
        callback()
      }
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

      NM_BOOK_COUNT++

      console.log('NM_BOOK_COUNT', NM_BOOK_COUNT)
      console.log('totalCount', totalCount)

      if(NM_BOOK_COUNT === totalCount) {
        callback()
      }
    })
  }
}
