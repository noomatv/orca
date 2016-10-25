const s3 = require('s3')

module.exports = {
  /**
   * input: null
   * output: s3 client object
   */
  createClient: function(s3Data) {
    return s3.createClient({
      maxAsyncS3: 20,     // this is the default
      s3RetryCount: 3,    // this is the default
      s3RetryDelay: 1000, // this is the default
      multipartUploadThreshold: 20971520, // this is the default (20 MB)
      multipartUploadSize: 15728640, // this is the default (15 MB)
      s3Options: {
        accessKeyId: s3Data.accessKeyId,
        secretAccessKey: s3Data.secretAccessKey,
        region: s3Data.region
      },
    })
  },
  checkIfDone: function(callback) {
    if(NM_PAGE_COUNT === NM_PAGE_LENGTH && NM_VIDEO_COUNT === NM_VIDEO_LENGTH
       && NM_OTHER_PAGE_COUNT === NM_OTHER_PAGE_LENGTH) {
      callback()
    }
  }
}
