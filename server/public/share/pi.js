var ipmap = {};

alert_head = '<div class="alert alert-danger alert-dismissible fade in" style="position: absolute; top: 0px; width: 100%; text-align: center; z-index: 2000;" role="alert">' +
                '<button type="button" class="close" data-dismiss="alert" aria-label="Close" onclick="removeCurrentAlert();"><span aria-hidden="true">&times;</span></button>' +
                '<strong>Error!</strong><span style="padding-left: 5px">'
alert_foot = '</span></div>'

success_head = '<div class="alert alert-success alert-dismissible fade in" style="position: absolute; top: 0px; width: 100%; text-align: center; z-index: 2000;" role="alert">' +
                '<button type="button" class="close" data-dismiss="alert" aria-label="Close" onclick="removeCurrentAlert();"><span aria-hidden="true">&times;</span></button>' +
                '<strong>Success!</strong><span style="padding-left: 5px">'
success_foot = '</span></div>'

is_server = false;
skipUpdateCount = 0;

// If there is an alert displayed, keep track of it so that we can avoid
// multiple existing at the same time
current_alert = undefined;

$(document).on('change', '.btn-file :file', function() {
    var input = $(this),
        numFiles = input.get(0).files ? input.get(0).files.length : 1,
        label = input.val().replace(/\\/g, '/').replace(/.*\//, '');

    input.trigger('fileselect', [numFiles, label]);
});

$(document).ready(function() {

    var bar = $('#uploadprogress');

    // Turn the submit event into an ajax call, so we can get a response from the server
    $('#fileupload').ajaxForm({
        error: function(res, status) {
            alertUser(res.status, res.responseText);
            $('#fileupload')[0].reset();
        },
        success: function(res, status) {
            alertUser(200, res);
            $('#fileupload')[0].reset();
        },
        uploadProgress: function(event, position, total, percentComplete) {
            var percentVal = percentComplete + '%';
            bar.width(percentVal);
        },
        clearForm: true
    });

    // Do some pre-validation before submit is clicked, and prevent the action if there are issues
    $('#print-submit').click(function(e) {

        if (is_server == true) {
            if ($('#print-target').attr('value') === undefined) {
                alertUser(400, 'You must select a printer first.');
                e.preventDefault();
            }
        }

    });

    // turn the config form into ajax call
    $('#configupload').ajaxForm({
        error: function(res, status) {
            dismissUploadConfigDialog();
            alertUser(res.status, res.responseText);
            $('#configupload')[0].reset();
        },
        success: function(res, status) {
            dismissUploadConfigDialog();
            alertUser(200, res);
            $('#configupload')[0].reset();
        },
        clearForm: true
    });

    // Do some pre-validation before config-submit is clicked, and prevent the action if there are issues
    $('#config-submit').click(function(e) {

        if (is_server == true) {
            alertUser(0, 'How did you click this?!');
            e.preventDefault();
            return;
        }

    });

    // When a file is selected, display it in the text box
    $('.btn-file :file').on('fileselect', function(event, numFiles, label) {
        var input = $(this).parents('.input-group').find(':text');

        input.val(label);
    });


    $('.clear-alert').click(function(e) {
        removeCurrentAlert();
    });

    // Register an onclick event to register a new printer from the add modal
    $('#add-printer-submit').click(function(e) {
        var pName = $('#add-printer-name')[0].value;
        var pIP = $('#add-printer-ip')[0].value;

        if (pName == '' || pIP == '') {
            alertUser(400, 'Must supply a name and IP address.');
            return;
        }

        $.ajax({
            url: '/api/regprinter',
            type: 'POST',
            data: JSON.stringify({printerName: pName, printerIP: pIP}),
            dataType: 'json',
            contentType: 'application/json'
        }).complete(function(data) { // is there a way to only call this when there is an error?
            alertUser(data.status, data.responseText);
        });

        dismissAddPrinterDialog();
        populatePrinterList();
    });

    // Register an onclick event to edit an existing printer from the edit modal
    $('#edit-printer-submit').click(function(e) {
        var npName = $('#edit-printer-name')[0].value,
            opName = $('#edit-printer-oname')[0].value,
            pIP = $('#edit-printer-ip')[0].value;

        if (npName == '' || pIP == '') {
            alertUser(0, 'Must supply a name and IP address.');
            return;
        }

        $.ajax({
            url: '/api/editprinter',
            type: 'POST',
            data: JSON.stringify({oldPrinterName: opName, newPrinterName: npName, printerIP: pIP}),
            dataType: 'json',
            contentType: 'application/json'
        }).complete(function(data) { // is there a way to only call this when there is an error?
            alertUser(data.status, data.responseText);
        });

        dismissEditPrinterDialog();
        populatePrinterList();
    });

    // Register an onclick event to set a url as the upload target
    $('#print-url-submit').click(function(e) {
        var url = $('#download-url')[0].value.trim();

        if (url != '') {
            $('#print-url').val(url);
            $('#upload-text-display').val(url);
            $('#print-type').val(1);
        }

        dismissPrintURLDialog();
    });


    // Update status of the current printer at regular intervals (if server)
    if (is_server) {
        setInterval(updatePrinterStatus, 1000);
    }
});


// Takes in a status (number) and message, and sets it as the 
// status. If undefined, requests status from the server
function updatePrinterStatus(status, msg) {

    if (status != undefined) {
        setPrinterStatus(status, msg);
        return;
    }

    var pName = $('#print-target')[0].value;

    if (pName != undefined) {
        $.get('/api/getstatus', {printerName: pName})
            .complete(function(data) {
                if (data.responseText != undefined) {
                    var obj = $.parseJSON(data.responseText);

                    setPrinterStatus(obj.status, obj.text);
                }
            });
    }
}

// If there's an alert being shown, remove it.
function removeCurrentAlert() {

    if (current_alert == undefined) {
        return;
    }

    if (current_alert.parentElement != undefined) {
        current_alert.parentElement.removeChild(current_alert);
    }
}

function setPrinterStatus(status, msg) {

    if (skipUpdateCount > 0) {
        --skipUpdateCount;
        return;
    }

    if (status < 100) {
        $('#serverStatus').css({'color':'green'});
    }
    else {
        $('#serverStatus').css({'color':'red'});
    }

    $('#serverStatus')[0].innerHTML = 'Printing Status: ' + msg;
}

// Assumes status is a standard http status
// If you want to call it without an http status use 0 for 'Error' and 200 for 'Success'
function alertUser(status, msg) {

    // Don't perform the next automatic setPrinterStatusUpdate, so the user
    // can actually see what's going on
    setPrinterStatus(status == 200 ? 0 : status, msg);
    skipUpdateCount = 2;

    // removeCurrentAlert();

    // var html = '';

    // if(status == 200) {
    //     html += success_head + msg + success_foot;
    // }
    // else {
    //     html += alert_head + msg + alert_foot;
    // }

    // var element = document.createElement('div');
    // element.innerHTML = html;

    // document.body.appendChild(element);

    // current_alert = element;
}

// Remove the Add Printer dialog and clear data
function dismissAddPrinterDialog() {
    $('#add-printer-modal').modal('hide');
    $('#add-printer-name')[0].value = '';
    $('#add-printer-ip')[0].value = '';
}

// Remove the Edit Printer dialog and clear data
function dismissEditPrinterDialog() {
    $('#edit-printer-modal').modal('hide');
    $('#edit-printer-name')[0].value = '';
    $('#edit-printer-ip')[0].value = '';
}

// Remove the Print from URL dialog and clear data
function dismissPrintURLDialog() {
    $('#print-url-modal').modal('hide');
    $('#download-url')[0].value = '';
}

function dismissUploadConfigDialog() {
    $('#config-modal').modal('hide');
    $('#configupload')[0].reset();
}

function setCurrentPrinter(name) {
    $('#printer-select-display')[0].innerHTML = name + '<span class="caret"></span>';
    updatePrinterStatus();

    // The name is being submitted to the server, so it can be verified as a registered printer
    // before initiating the slicing job.
    $('#print-target')[0].value = name;
}

function populatePrinterList() {
    // Populate dropdown list
    $.get("/api/getprinters", function(data, status) {

        // Clear dropdown list to prepare it to be repopulated
        $('#printer-select')[0].innerHTML = '';

        for (var i=0; i<data.printers.length; ++i) {

            var listEl = document.createElement('li'),
                rightPadding = '60px',
                editButtons = '' +
                    '<div class="btn-group btn-group-xs" role="group" style="position: absolute; margin-top: -22px; right: 5px;">' +
                        '<button type="button" class="btn btn-default clear-alert" onclick="removeCurrentAlert();" name="editprinter" value="' + data.printers[i].name + '">' +
                            '<span class="glyphicon glyphicon-pencil" aria-hidden="true"></span>&nbsp;' +
                        '</button>' +
                        '<button type="button" class="btn btn-default clear-alert" onclick="removeCurrentAlert();" name="delprinter" value="' + data.printers[i].name + '">&times</button>' +
                    '</div>';

            if (data.locked) {
                rightPadding = '0px';
                editButtons = '';
            }

            listEl.innerHTML = '<a style="padding-right:' + rightPadding + ';">' + data.printers[i].name + '</a>' + editButtons;

            $('#printer-select')[0].appendChild(listEl);

            // Keep track of the ip addresses of the registered printers. This is to allow for easy editing and viewing.
            ipmap[data.printers[i].name] = data.printers[i].ip;
        }

        if (!data.locked) {

            // Create and append the 'Add Printer' option
            var listSep = document.createElement('li');
            listSep.setAttribute('role', 'presentation');
            listSep.setAttribute('class', 'divider clear-alert');
            $('#printer-select')[0].appendChild(listSep);

            var addPrinter = document.createElement('li');
            addPrinter.innerHTML = '<a id=\'add-printer\' data-toggle="modal" onclick="removeCurrentAlert();" data-target="#add-printer-modal">Add Printer</a>';
            $('#printer-select')[0].appendChild(addPrinter);


            // Register a callback for the edit/delete buttons on each of the dropdown items
            $('#printer-select li div button').click(function(e) {
                var action = e.currentTarget.attributes['name'].value;
                var pName = e.currentTarget.attributes['value'].value;

                if (action === 'delprinter') {
                    $.ajax({
                        url: '/api/delprinter',
                        type: 'POST',
                        data: JSON.stringify({printerName: pName}),
                        dataType: 'json',
                        contentType: 'application/json'
                    });

                    populatePrinterList();
                }
                else if (action === 'editprinter') {

                    if (ipmap[pName] == undefined) {
                        alertUser(0, 'Invalid printer selected.');
                        populatePrinterList();
                        return;
                    }

                    $('#edit-printer-name')[0].value = pName;
                    $('#edit-printer-ip')[0].value = ipmap[pName];
                    $('#edit-printer-oname')[0].value = pName;
                    $('#edit-printer-modal').modal('show');
                }
            });
        }

        // If there is at least one printer, set it as the default
        // If the list is locked for editing, the seperator and add printer button are not there
        var plist = $('#printer-select')[0];
        if (plist.children.length > (data.locked ? 0 : 2)) {
            setCurrentPrinter($('#printer-select')[0].children[0].children[0].text);
        }
        // If there are no printers in the list current, default to 'Select Printer' (to allow the user to click 'Add Printer')
        else {
            $('#printer-select-display')[0].innerHTML = 'Select Printer<span class="caret"></span>';
        }

        // Set clicked menu item to be the currently chosen item
        $('#printer-select li a').click(function(e) {
            
            if (e.currentTarget.attributes['id'] != undefined && e.currentTarget.attributes['id'].value === 'add-printer') {
                console.log('add-printer');
            }
            else {
                setCurrentPrinter(e.currentTarget.innerText);
            }
        });
    }).complete(function(data) { // is there a way to only call this when there is an error?
        if (data.status != 200) {
            alertUser(data.status, data.responseText);
        }
    });
}