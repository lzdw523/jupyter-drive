// Copyright (c) IPython Development Team.
// Distributed under the terms of the Modified BSD License.

define([
    'base/js/namespace',
    'jquery',
    'base/js/dialog',
    'base/js/utils',
], function(IPython, $, dialog, utils) {
    /**
     * Authorization Utilities
     *
     * Utilities for doing OAuth flow with the Google API.
     */

    /**
     * Wrap a Google API result as an error.  Returns null if the result does
     * not represent an error
     * @param {Object} result The result of a Google API call, as returned
     *     by a request.execute method.
     * @return {Error} The result wrapped as an error, or null.
     */
    var wrap_gapi_error = function(result) {
        var error = null;
        if (!result) {
            // Error type 1: result is False
            var error = new Error('Unknown error during Google API call');
            error.name = 'GapiError';
        } else if (result['error']) {
            // Error type 2: an error resource (see
            // https://developers.google.com/drive/web/handle-errors)
            var error = new Error(result['error']['message']);
            error.gapi_error = result['error'];
	}
        return error;
    }

    /**
     * Make a Google API request.  Detects if the resonpose is an error and
     * wrapping the response appropriately if it is.
     *
     * Typical usage:
     * var request = gapi.client.drive.files.get({
     *     'fileId': fileId
     * });
     * execute_gapi_request(request, succes, error);
     *
     * @param {Object} request The request, generated by the Google JavaScript
     *     client API.
     * @return {Promise} Fullfilled with the result on success, or the
     *     result wrapped as an Error on error.
     */
    var wrap_gapi_request = function(request) {
        var defer = $.Deferred();
        request.execute(defer.resolve, function(result) {
            defer.reject(wrap_gapi_error(result));
        });
        return defer.promise();
    }

    /**
     * (Internal use only) Returns a promise that is fullfilled when client
     * library loads.
     */
    var load_gapi_1 = function() {
        return $.getScript('https://apis.google.com/js/client.js')
         .then(function() {
            var defer = $.Deferred();
            function poll_for_gapi_load() {
                if (window.gapi && gapi.client) {
                    defer.resolve();
                } else {
                    setTimeout(poll_for_gapi_load, 100);
                }
            }
            poll_for_gapi_load();
            return defer.promise();
         }, utils.wrap_ajax_error);
    };

    /**
     * (Internal use only) Returns a promise fullfilled when client library
     * loads.
     */
    var load_gapi_2 = function() {
        var defer = $.Deferred();
        gapi.load('auth:client,drive-realtime,drive-share', function() {
            gapi.client.load('drive', 'v2', function() {
                defer.resolve();
            });
        });
        return defer.promise();
    };

    /**
     * Returns a promise fullfilled when the Google API has authorized.
     * @param {boolean} opt_withPopup If true, display popup without first
     *     trying to authorize without a popup.
     */
    var authorize = function(opt_withPopup) {
        var authorize_internal = function() {
            var defer = $.Deferred();
            gapi.auth.authorize({
                'client_id': '911569945122-tlvi6ucbj137ifhitpqpdikf3qo1mh9d.apps.googleusercontent.com',
                'scope': ['https://www.googleapis.com/auth/drive'],
                'immediate': !opt_withPopup
            }, function(response) {
                var error = wrap_gapi_error(response);
                if (error) {
                    defer.reject(error);
		} else {
                    defer.resolve();
		}
            });
            return defer.promise();
        };

        if (opt_withPopup) {
            var defer = $.Deferred();
            // Gets user to initiate the authorization with a dialog,
            // to prevent popup blockers.
            var options = {
                title: 'Authentication needed',
                body: ('Accessing Google Drive requires authentication.  Click'
                    + ' ok to proceed.'),
                buttons: {
                    'ok': { click : function() { defer.resolve(authorize_internal()); },
			  },
                    'cancel': { click : defer.reject }
		}
            }
            dialog.modal(options);
            return defer.promise();
        } else {
            // Return result of authorize, trying again with withPopup=true
            // in case of failure.
            return authorize_internal().then(null, function() {
                return authorize(true);
            });
	}
    };

    /**
     * Promise fullfilled when gapi is loaded, and authorization is complete.
     */
    var gapi_ready = load_gapi_1().then(load_gapi_2).then(authorize);

    var drive_utils = {
        wrap_gapi_request : wrap_gapi_request,
        gapi_ready : gapi_ready
    };

    return drive_utils;
});