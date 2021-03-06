// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const { ipcRenderer, remote, shell } = require('electron')
const { dialog } = remote
const storage = require('electron-json-storage')
const $ = require('jQuery')

// storage.clear(function(error) {
//   if (error) throw error;
// });

storage.get('aws-credentials', function(error, data) {
  if (error) throw error

  $('#access-key-id-input').val(data.accessKeyId)
  $('#secret-access-key-input').val(data.secretAccessKey)
  $('#region-input').val(data.region)
  $('#bucket-input').val(data.bucket)
  $('#community-id-input').val(data.commId)
})

storage.get('directory', function(error, data) {
  if (error) throw error

  $('#directory-path-input').val(data.directory)
})

function hideSections() {
  $('.section').css('display', 'none')
  $('.toolbar button').removeClass('active')
}

function updateAws() {
  var awsCredentials = {
    accessKeyId: $('#access-key-id-input').val(),
    secretAccessKey: $('#secret-access-key-input').val(),
    region: $('#region-input').val(),
    bucket: $('#bucket-input').val(),
    commId: $('#community-id-input').val()
  }

  storage.set('aws-credentials', awsCredentials, function(error) {
    if (error) throw error
    console.log('AWS credentials updated')
  })
}

function updateDirectory() {
  storage.set('directory', { directory: $('#directory-path-input').val() }, function(error) {
    if (error) throw error
    console.log('Directory updated')
  })
}

$('#aws-section form').on('input', function() {
  updateAws()
});

$('#bookshelf-section form').on('input', function() {
  updateDirectory()
});

$('#aws-section-button').on('click', function() {
  hideSections()
  $(this).addClass('active')
  $('#aws-section').css('display', 'block')
})

$('#bookshelf-section-button').on('click', function() {
  hideSections()
  $(this).addClass('active')
  $('#bookshelf-section').css('display', 'block')
})

$('#sync-section-button').on('click', function() {
  hideSections()
  $(this).addClass('active')
  $('#sync-section').css('display', 'block')
})

$('#sync-button').on('click', function() {
  $('#sync-button').prop('disabled', true)
  $('#sync-button').removeClass("btn-primary")
  $('#sync-button').html('Syncing')
  $('#update-status-paragraph').html('')
  $('#progress-table').html('')

  ipcRenderer.send('did-submit-form', {
    s3Data: {
      accessKeyId: $('#access-key-id-input').val(),
      secretAccessKey: $('#secret-access-key-input').val(),
      region: $('#region-input').val(),
      bucket: $('#bucket-input').val(),
      commId: $('#community-id-input').val()
    },
    // var dirname = '/Users/dev1/Dropbox/Zappy Code'
    dirname: $('#directory-path-input').val()
  })
})

ipcRenderer.on('done-syncing', (event, msg) => {
  $('#sync-button').prop('disabled', false)
  $('#update-status-paragraph').text('Done')
  $('#sync-button').addClass("btn-primary")
  $('#sync-button').html('Sync')
})

ipcRenderer.on('update-status', (event, msg) => {
  $('#update-status-paragraph').text(msg.msg)
})

ipcRenderer.on('update-progress', (event, incoming) => {
  if($('#' + incoming.id).length) {
    var tableRow = `<td>${incoming.name}</td>
                    <td>${incoming.progressAmount}</td>
                    <td>${incoming.progressTotal}</td>
                    <td class="progress">${incoming.progress}</td>`

    $('#' + incoming.id).html(tableRow)
  } else {
    var tableRow = `<tr id=${incoming.id}>
                      <td>${incoming.name}</td>
                      <td>${incoming.progressAmount}</td>
                      <td>${incoming.progressTotal}</td>
                      <td class="progress">${incoming.progress}</td>
                    </tr>`

    $('#progress-table').append(tableRow)
  }
})

ipcRenderer.on('done-uploading', (event, incoming) => {
  $('#' + incoming.id + ' td.progress').text('Done')
})

ipcRenderer.on('upload-error', (event, incoming) => {
  $('#' + incoming.id + ' td.progress').text('Error')
})
