var markdown = require('markdown').markdown
var cheerio = require('cheerio')
var yaml = require('yamljs')
var fs = require('fs')
var dir = require('node-dir')
var FHelper = require('./file-helper')

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

  insertFrontMatter: function(mdStr, newDataObj, callback) {
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
    callback(newFrontMatter + mdBody)
  },

  /**
   * input: file path to a markdown file
   * output: if front matter and specified key found return value of key
   */
  findKeyIn: function(mdFilePath, key) {
    fs.readFile(mdFilePath, 'utf-8', function(err, data) {
      if(err) {
        console.log(err)
      } else {
        var frontMatter = this.findFrontMatter(data)

        if(frontMatter && frontMatter[key] !== undefined) {
          return frontMatter[key]
        } else {
          return false
        }
      }
    })
  },

  findKeyInMarkdown: function(mdStr, key) {
    var frontMatter = this.findFrontMatter(mdStr)

    if(frontMatter && frontMatter[key] !== undefined) {
      return frontMatter[key]
    } else {
      return false
    }
  }
}
