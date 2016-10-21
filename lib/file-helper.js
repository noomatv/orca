var uuid = require('uuid')

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
  }
}
