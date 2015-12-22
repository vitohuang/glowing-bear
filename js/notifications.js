var weechat = angular.module('weechat');

weechat.factory('notifications', ['$rootScope', '$log', 'models', 'settings', function($rootScope, $log, models, settings) {
    var serviceworker = false;
    var notifications = [];
    // Ask for permission to display desktop notifications
    var requestNotificationPermission = function() {
        // Firefox
        if (window.Notification) {
            Notification.requestPermission(function(status) {
                $log.info('Notification permission status: ', status);
                if (Notification.permission !== status) {
                    Notification.permission = status;
                }
            });
        }

        // Webkit
        if (window.webkitNotifications !== undefined) {
            var havePermission = window.webkitNotifications.checkPermission();
            if (havePermission !== 0) { // 0 is PERMISSION_ALLOWED
                $log.info('Notification permission status: ', havePermission === 0);
                window.webkitNotifications.requestPermission();
            }
        }

        if ('serviceWorker' in navigator) {
            $log.info('Service Worker is supported');
            navigator.serviceWorker.register('serviceworker.js').then(function(reg) {
                $log.info('Service Worker install:', reg);
                serviceworker = true;
            }).catch(function(err) {
                $log.info('Service Worker err:', err);
            });
        }
    };

    var showNotification = function(buffer, title, body) {
        if (serviceworker) {
            navigator.serviceWorker.ready.then(function(registration) {
                registration.showNotification(title, {
                    body: body,
                    icon: 'assets/img/glowing_bear_128x128.png',
                    vibrate: [200, 100],
                    tag: 'gb-highlight-vib'
                });
            });
        } else {
            var notification = new Notification(title, {
                body: body,
                icon: 'assets/img/favicon.png'
            });

            // Save notification, so we can close all outstanding ones when disconnecting
            notification.id = notifications.length;
            notifications.push(notification);

            // Cancel notification automatically
            var timeout = 15*1000;
            notification.onshow = function() {
                setTimeout(function() {
                    notification.close();
                }, timeout);
            };

            // Click takes the user to the buffer
            notification.onclick = function() {
                models.setActiveBuffer(buffer.id);
                window.focus();
                notification.close();
            };

            // Remove from list of active notifications
            notification.onclose = function() {
                delete notifications[this.id];
            };
        }
    };


    // Reduce buffers with "+" operation over a key. Mostly useful for unread/notification counts.
    var unreadCount = function(type) {
        if (!type) {
            type = "unread";
        }

        // Do this the old-fashioned way with iterating over the keys, as underscore proved to be error-prone
        var keys = Object.keys(models.model.buffers);
        var count = 0;
        for (var key in keys) {
            count += models.model.buffers[keys[key]][type];
        }

        return count;
    };


    var updateTitle = function() {
        var notifications = unreadCount('notification');
        if (notifications > 0) {
            // New notifications deserve an exclamation mark
            $rootScope.notificationStatus = '(' + notifications + ') ';
        } else {
            $rootScope.notificationStatus = '';
        }

        var activeBuffer = models.getActiveBuffer();
        if (activeBuffer) {
            $rootScope.pageTitle = activeBuffer.shortName + ' | ' + activeBuffer.rtitle;
        }
    };

    var updateFavico = function() {
        var notifications = unreadCount('notification');
        if (notifications > 0) {
            $rootScope.favico.badge(notifications, {
                    bgColor: '#d00',
                    textColor: '#fff'
            });
        } else {
            var unread = unreadCount('unread');
            if (unread === 0) {
                $rootScope.favico.reset();
            } else {
                $rootScope.favico.badge(unread, {
                    bgColor: '#5CB85C',
                    textColor: '#ff0'
                });
            }
        }
    };

    /* Function gets called from bufferLineAdded code if user should be notified */
    var createHighlight = function(buffer, message) {
        var title = '';
        var body = '';
        var numNotifications = buffer.notification;

        if (buffer.type === "private") {
            if (numNotifications > 1) {
                title = numNotifications.toString() + ' private messages from ';
            } else {
                title = 'Private message from ';
            }
            body = message.text;
        } else {
            if (numNotifications > 1) {
                title = numNotifications.toString() + ' highlights in ';
            } else {
                title = 'Highlight in ';
            }
            var prefix = '';
            for (var i = 0; i < message.prefix.length; i++) {
                prefix += message.prefix[i].text;
            }
            body = '<' + prefix + '> ' + message.text;
        }
        title += buffer.shortName + " (" + buffer.server + ")";

        showNotification(buffer, title, body);

        if (settings.soundnotification) {
            // TODO fill in a sound file
            var audioFile = "assets/audio/sonar";
            var soundHTML = '<audio autoplay="autoplay"><source src="' + audioFile + '.ogg" type="audio/ogg" /><source src="' + audioFile + '.mp3" type="audio/mpeg" /></audio>';
            document.getElementById("soundNotification").innerHTML = soundHTML;
        }
    };

    var cancelAll = function() {
        while (notifications.length > 0) {
            var notification = notifications.pop();
            if (notification !== undefined) {
                notification.close();
            }
        }
    };

    return {
        requestNotificationPermission: requestNotificationPermission,
        updateTitle: updateTitle,
        updateFavico: updateFavico,
        createHighlight: createHighlight,
        cancelAll: cancelAll,
        unreadCount: unreadCount
    };
}]);
