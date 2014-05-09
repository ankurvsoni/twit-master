var fs = require('fs'),
    http = require('http'),
    connect = require('connect'),
    url = require('url'),
    _ = require('underscore')._,
    util = require('util');

console.log("===Live charting with Node.js===");

var OAuth = require('oauth').OAuth;
var consumerKey = 'consumerKey';
var consumerSecret = 'consumerSecret';
var accessToken = 'accessToken';
var accessTokenSecret = 'accessTokenSecret';

var oa = new OAuth(
    "https://api.twitter.com/oauth/request_token",
    "https://api.twitter.com/oauth/access_token",
    consumerKey,
    consumerSecret,
    "1.0",
    null,
    "HMAC-SHA1"
);

startTrendRequest();
setInterval(startTrendRequest, 6 * 60 * 1000);
setInterval(clearCache, 10 * 60 * 1000);
setInterval(monitorMemory, 60 * 1000);

var track = "";

function startTrendRequest() {
    track = "";
    var trendRequest = oa
        .get(
            "https://api.twitter.com/1/trends/23424977.json",
            accessToken,
            accessTokenSecret,
            // null, null,
            function(error, data, response) {
                if (error) {
                    console.log(error);
                    return;
                }

                var pt = JSON.parse(data);

                // console.log(JSON.stringify(pt[0].trends));

                for (var key in pt[0].trends) {
                    if (pt[0].trends.hasOwnProperty(key)) {

                        // console.log(pt[0].trends[key].name);

                        var name = pt[0].trends[key].name;
                        track += name + ",";
                    }
                }

                track = track.substr(0, track.length - 1);
                console.log('Popular keywords: ' + track);
                var url = 'https://stream.twitter.com/1/statuses/filter.json?track=' + encodeURIComponent(track);

                if (request != undefined) {
                    request.abort();
                }

                console.log("Starting new request [" + url + "]");
                startRequest(url);
            });
}

var message = "";
var users = [];
var tweetCount = 0;
var request;

function startRequest(url) {
    request = oa.get(url, accessToken, accessTokenSecret);

    // Response Parsing -------------------------------------------- //
    request.addListener('response', function(response) {
        response.setEncoding('utf8');
        response.addListener("data", function(chunk) {
            message += chunk;
            var newlineIndex = message.indexOf('\r');
            // response should not be sent until message includes '\r'.
            // Look at the section titled "Parsing Responses" in Twitter's
            // documentation.
            if (newlineIndex !== -1) {
                var tweet = message.slice(0, newlineIndex);
                // this just tests if we are receiving tweets -- we are:
                // terminal successfully outputs stream //
                var pt = JSON.parse(tweet);
                updateUserTweetCount(pt);
            }
            message = message.slice(newlineIndex + 1);
        });

    });
    request.end();
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
            var d = new Date();
            var startTime = d.toTimeString();
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
            res.end(JSON.stringify(tweetCount));
        }

    }).listen(9999, function() {
    console.log('Listening at: http://localhost:9999');
});

var retVal = [];
setInterval(processUserTweets, 10000);

function updateUserTweetCount(tweet) {
    if (tweet.user == undefined || tweet.user.screen_name == undefined) {
        return;
    }

    tweetCount++;
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
    var usersMap = [];
    for (var key in users) {
        usersMap.push({
            name: key,
            tweets: users[key]
        });
    }

    var sorted = _.sortBy(usersMap, function(user) {
        return user.tweets;
    });
    sorted.reverse();

    retVal = [];
    for (x in sorted) {
        if (x == 10) {
            break;
        }
        retVal.push(sorted[x]);
    }

    var end = new Date().getTime();
    var time = end - start;

    console.log("Time taken (ms): [" + time + "] for [" + sorted.length + "] records");
    console.log("Total tweets received [" + tweetCount + "]");
}

function getResults() {
    return JSON.stringify(retVal);
}

function random() {
    return parseInt(Math.floor((Math.random() * 100) + 1));
}

function clearCache() {
    console.log("Cache cleared");
    users = [];
}

function monitorMemory() {
    console.log(util.inspect(process.memoryUsage()));
}