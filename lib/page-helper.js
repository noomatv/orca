const markdown = require('markdown').markdown
const cheerio = require('cheerio')
const yaml = require('yamljs')
const fs = require('fs')
const dir = require('node-dir')
const uuid = require('uuid')
const FHelper = require('./file-helper')
const GHelper = require('./general-helper')

module.exports = {
    /**
   * input: file path to video
   * output: if markdown found file path else return false
   */
  findMarkdownFile: function(filePath, callback) {
    var directoryPath = filePath.substring(0, filePath.lastIndexOf('/'))

    dir.files(directoryPath, function(err, files) {
      if (err) throw err
      var pages = FHelper.getFiles(files, 'md')

      if(pages.length > 0) {

        fs.readFile(pages[0], 'utf-8', function(err, data) {
          if(err) {
            return callback(false)
          } else {
            return callback(pages[0], data)
          }
        })
      } else {
        return callback(false)
      }
    })
  },

  /**
   * input: string in markdown
   * output: if front matter exists return it in object form else return false
   */
  findFrontMatter: function(str) {
    var htmlStr = markdown.toHTML(str.trim())
    var $ = cheerio.load(htmlStr)

    var frontMatter = $($('p')[0]).text()

    if(frontMatter.indexOf('<!--') === -1) {
      return false
    }

    frontMatter = frontMatter.replace('<!--', '')
    frontMatter = frontMatter.replace('-->', '')
    return yaml.parse(frontMatter.trim())
  },

  /**
   * input: markdown string and an object of key values to add to front matter
   * output: markdown content with front matter added
   */
  insertFrontMatter: function(mdStr, newDataObj) {
    var frontMatter = this.findFrontMatter(mdStr.trim())
    var mdBody = mdStr.trim()

    if(frontMatter) {
      for(var k in newDataObj) {
        frontMatter[k] = newDataObj[k]
      }

      mdBody = mdStr.substring(mdStr.lastIndexOf('-->') + 3)
      mdBody = mdBody.trim()
    } else {
      frontMatter = newDataObj
    }

    var newFrontMatter = '<!--\n'

    for(var k in frontMatter) {
      newFrontMatter += k + ': ' + frontMatter[k] + '\n'
    }

    newFrontMatter += '-->\n\n'

    return newFrontMatter + mdBody
  },

  replaceFrontMatter: function(mdContent, newFrontMatter) {
    var mdBody = mdContent.substring(mdContent.lastIndexOf('-->') + 3).trim()
    return this.insertFrontMatter(mdBody, newFrontMatter)
  },

  /**
  * input: file path to create markdown, title of page
  * output: returns callback
  * notes: used tightly with VHelper.getLastSync
  */
  createDefaultMarkdown: function(mdFilePath, pageTitle, callback) {
    var defaultFrontMatter = {
      id: uuid.v4()
    }

    var mdContent = this.insertFrontMatter('# ' + pageTitle, defaultFrontMatter)

    fs.writeFile(mdFilePath, mdContent, function (err) {
      if (err) {
        console.log(err)

      } else {
        // TODO: Send message back with sender
        console.log('done')
      }

      return callback(false)
    })
  },

  /**
   * input: markdown string and the key to look for in front matter
   * output: if front matter and specified key found return value else false
   */
  findKeyInMarkdown: function(mdStr, key) {
    var frontMatter = this.findFrontMatter(mdStr)

    if(frontMatter && frontMatter[key] !== undefined) {
      return frontMatter[key]
    } else {
      return false
    }
  },

  /**
   * input: array of file paths to markdown, callback
   * output: triggers callback if done
   * side effect: adds id to markdown without it
   */
  addIdToPagesWithoutIt: function(pages, callback) {
    var self = this
    pages.forEach(function(page) {
      fs.readFile(page, 'utf-8', function(err, data) {
        if(!self.findKeyInMarkdown(data, 'id')) {
          var mdContent = self.insertFrontMatter(data, { id: uuid.v4() })

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
  }
}
