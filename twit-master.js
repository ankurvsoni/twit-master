var fs = require('fs'),
    http = require('http'),
    connect = require('connect'),
    url = require('url'),
    _ = require('underscore')._,
    util = require('util'),
    querystring = require('querystring');

console.log("===Tweet master with Node.js===");

var track = "";
var filterUrl = 'https://stream.twitter.com/1/statuses/filter.json';
var trendUrl = 'https://api.twitter.com/1/trends/23424977.json';
var keywords;
var message = "";
var users = [];
var tweetCount = 0;
var request;
var now = new Date();
var startTime = now.toUTCString();
var port = 8080;
var twitMasters = [];
var oa;

// OAuth settings
var OAuth = require('oauth').OAuth;
var consumerKey = 'consumerKey';
var consumerSecret = 'consumerSecret';
var accessToken = 'accessToken';
var accessTokenSecret = 'accessTokenSecret';

init();

function init() {
    initOAuth();
    startTrendRequest();

    // Refresh trends after 11 minutes
    setInterval(startTrendRequest, 11 * 60 * 1000);
    // Process tweets every 10 seconds
    setInterval(processUserTweets, 10 * 1000);
    setInterval(monitorMemory, 5 * 60 * 1000);
}

function initOAuth() {
    oa = new OAuth(
        "https://api.twitter.com/oauth/request_token",
        "https://api.twitter.com/oauth/access_token",
        consumerKey,
        consumerSecret,
        "1.0",
        null,
        "HMAC-SHA1");
}

function startTrendRequest() {
    track = "";
    var trendRequest = oa
        .get(
            trendUrl,
            accessToken,
            accessTokenSecret,
            function(error, data, response) {
                if (error) {
                    console.log(error);
                    return;
                }

                var pt = JSON.parse(data);
                for (var key in pt[0].trends) {
                    if (pt[0].trends.hasOwnProperty(key)) {
                        var name = pt[0].trends[key].name;
                        track += name + ",";
                    }
                }

                track = track.substr(0, track.length - 1);
                console.log('Popular trends: ' + track);
                stream();
            });
}

function stream() {
    keywords = querystring.stringify({
        'track': track
    });

    var requestUrl = filterUrl + '?' + keywords;
    console.log("Starting new request [" + requestUrl + "]");
    if (request != undefined) {
        abortRequest(request);
    }

    request = oa.get(
        requestUrl,
        accessToken, accessTokenSecret);

    // Response Parsing -------------------------------------------- //
    request.addListener('response', function(response) {
        response.setEncoding('utf8');
        response.on('data', function(chunk) {
            message += chunk;
            var newlineIndex = message.indexOf('\r');
            // response should not be sent until message includes '\r'.
            // Look at the section titled "Parsing Responses" in Twitter's
            // documentation.
            if (newlineIndex !== -1) {
                var tweet = message.slice(0, newlineIndex);
                // this just tests if we are receiving tweets -- we are:
                // terminal successfully outputs stream //
                try {
                    var pt = JSON.parse(tweet);
                } catch (e) {
                    console.log(tweet);
                    console.log(JSON.stringify(response.headers));
                    abortRequest(request);
                    return;
                }
                updateUserTweetCount(pt);
            }
            message = message.slice(newlineIndex + 1);
        });

        response.on("close", function() {
            console.log(JSON.stringify(response.headers));
            console.log("Server response [" + response.statusCode + "] closed");
            //stream();
        });

        response.on("end", function() {
            console.log(JSON.stringify(response.headers));
            console.log("Server response [" + response.statusCode + "] ended");

        });

    });
    request.end();

    request.on('error', function(e) {
        console.log('problem with request: ' + e.message);
    });
}

var server = connect.createServer(connect.static(__dirname),
    function(req, res) {
        var uri;
        uri = url.parse(req.url).pathname;
        if (uri === '/fetch') {
            res.writeHead(200, {
                'Content-Type': 'text/json'
            });
            res.end(getResults());
        } else if (uri === '/startTime') {
            res.writeHead(200, {
                'Content-Type': 'text/json'
            });
            console.log(startTime);
            res.end(JSON.stringify({
                time: startTime
            }));
        } else if (uri === '/trends') {
            res.writeHead(200, {
                'Content-Type': 'text/json'
            });
            var trends = track.split(",");
            res.end(JSON.stringify(trends));
        } else if (uri === '/tweetCount') {
            res.writeHead(200, {
                'Content-Type': 'text/json'
            });
            console.log("Total tweets received [" + tweetCount + "]");
            res.end(JSON.stringify(tweetCount));
        }

    }).listen(port, function() {
    console.log('Starting server on port [' + port + ']');
});

function updateUserTweetCount(tweet) {
    if (tweet.user == undefined || tweet.user.screen_name == undefined) {
        if (tweet.limit != undefined) {
            console.log("Tweet limit [" + tweet.limit.track + "]");
        }
        return;
    }

    tweetCount++;
    if (tweetCount > 300000) {
        clearCache();
    }
    
    var screenName = tweet.user.screen_name;
    var count = users[screenName];
    if (count != undefined) {
        users[screenName] += 1;
    } else {
        users[screenName] = 1;
    }
}

function processUserTweets() {
    var start = new Date().getTime();
    var unsortedUsers = [];
    for (var key in users) {
        unsortedUsers.push({
            name: key,
            tweets: users[key]
        });
    }
    var sortedUsers = _.sortBy(unsortedUsers, function(user) {
        return user.tweets;
    });
    sortedUsers.reverse();

    twitMasters = [];
    for (x in sortedUsers) {
        if (x == 10) {
            break;
        }
        twitMasters.push(sortedUsers[x]);
    }
    var end = new Date().getTime();
    var time = end - start;
    console.log("Time taken (ms): [" + time + "] for [" + sortedUsers.length + "] records");
}

function getResults() {
    return JSON.stringify(twitMasters);
}

function clearCache() {
    console.log("Cache cleared");
    users = [];
    tweetCount = 0;
    now = new Date();
    startTime = now.toUTCString();
}

function monitorMemory() {
    console.log(util.inspect(process.memoryUsage()));
}

function abortRequest(request) {
    request.abort();
    console.log("Request aborted");
}