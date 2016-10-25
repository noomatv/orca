const uuid = require('uuid')
const dir = require('node-dir')
const path = require('path')
const fs = require('fs')
const mkdirp = require('mkdirp');

module.exports = {
  /**
   * input: full path to file
   * output: unique name for s3
   * TODO: make compatible with all os
   */
  generateFileName: function(fileName) {
    var withExtension = fileName.substring(fileName.lastIndexOf('/') + 1)
    var withoutExtension = withExtension.substring(0, withExtension.lastIndexOf('.'))
    return withoutExtension + '|' + uuid.v4().substring(0, 8)
  },

  /**
   * input: full path to file
   * output: just the file without the path
   * TODO: make compatible with all os
   */
  generateStatusFileName: function(fileName) {
    return fileName.substring(fileName.lastIndexOf('/') + 1)
  },

  /**
   * input: array of file names, extension type (i.e. 'mp4')
   * output: array of file names with specified extension
   */
  getFiles: function(files, type) {
    return files.filter(function (file) {
      return file.indexOf(type) > -1
    })
  },

  /**
  * input: two objects containing file information
  * output: returns true if they are the same file (same birthtime and size)
  */
  isSameFile: function(stats, lastSync) {
    return this.sameBirthTime(stats, lastSync) && this.sameSize(stats, lastSync)
  },

  /**
  * input: two objects containing file information
  * output: returns true if birthtime are equal
  * notes: birthtime is stored in integer form
  */
  sameBirthTime: function(stats, lastSync) {
    return (+stats['birthtime']).toString() === lastSync['birthtime']
  },

  /**
  * input: two objects containing file information
  * output: returns true if birthtime are equal
  * notes: birthtime is stored in integer form
  */
  sameSize: function(stats, lastSync) {
    return (stats['size']).toString() === lastSync['size']
  },

  /**
  * input: file path to a file
  * output: returns file path without the file
  */
  filePathWithoutFile: function(filePath) {
    return filePath.substring(0, filePath.lastIndexOf('/'))
  },

  moveVideosToTempSyncing(dirname, callback) {
    var self = this
    dir.files(dirname, function(err, files) {
      if (err) throw err

      videos = self.getFiles(files, 'mp4')
      videoCount = 0

      videos.forEach(function(video) {
        var oldPath = video

        var withoutDir = oldPath.replace(dirname, '')
        var withoutDirArr = withoutDir.split(path.sep)

        var newPath = dirname + '/tmp' + withoutDirArr.join(path.sep)

        mkdirp(path.dirname(newPath), function (err) {
          if(err) {
            console.log(err)
            videoCount++
            if(videoCount == videos.length) {
              callback()
            }
          } else {
            fs.rename(oldPath, newPath, function() {
              videoCount++
              if(videoCount == videos.length) {
                callback()
              }
            })
          }
        })
      })
    })
  },

  moveVideosBackFromTempSyncing(dirname, callback) {
    var self = this
    dir.files(dirname, function(err, files) {
      if (err) throw err

      videos = self.getFiles(files, 'mp4')
      videoCount = 0

      videos.forEach(function(video) {
        var oldPath = video

        var withoutDir = oldPath.replace(dirname, '')
        var withoutDirArr = withoutDir.split(path.sep)

        var newPath = withoutDirArr.join(path.sep).replace('tmp/', '')

        console.log('newPath', dirname + newPath)
        console.log('oldPath', oldPath)

        fs.rename(oldPath, dirname + newPath, function() {
          videoCount++
          if(videoCount == videos.length) {
            callback()
          }
        })
      })
    })
  },

  getDirectories: function(dirname) {
    return fs.readdirSync(dirname).filter(function(file) {
      return fs.statSync(path.join(dirname, file)).isDirectory();
    });
  }
}
