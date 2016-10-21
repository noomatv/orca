var uuid = require('uuid')

module.exports = {
  /**
   * input: name of file
   * output: unique name for s3
   */
  generateFileName: function(fileName) {
    var withExtension = fileName.substring(fileName.lastIndexOf('/') + 1)
    var withoutExtension = withExtension.substring(0, withExtension.lastIndexOf('.'))
    return withoutExtension + '|' + uuid.v4().substring(0, 8)
  },

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
  }
}
