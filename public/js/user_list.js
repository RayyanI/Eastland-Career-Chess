'use strict';

(function () {
    var $search  = $('#search_user');
    var $perPage = $('#per_page');
    var oldValue = $perPage.val();
    var path     = window.location.pathname;
    var isSearch = /^\/search\/user\//.test(path);
    var isLeader = /^\/leaderboards\//.test(path);

    $perPage.on('change', function () {
        var p = $perPage.val();
        var parts;


        if (p === oldValue) return;

        if (isSearch) {
            parts = window.location.href.split('/');
            parts.splice(parts.length - 2, 2, [p, 1]);
            window.location.href = parts.join('/');
        } else if (isLeader) {
            window.location.href = '/leaderboards/' + p + '/1';
        }
    });

    $search.on('keydown', function (e) {
        var query;

        if (e.keyCode === 13) {
            query = $search.val().replace(/^\s+|\s+$/g, '');

            if (query.length === 0) {
                window.location.href = '/leaderboards';
            } else {
                window.location.href = '/search/user/' + query + '/' + oldValue + '/1';
            }

        }
    });

})();
