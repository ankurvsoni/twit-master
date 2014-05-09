var chart; // global
var data = [];
var categories = [];
var startTime = '';

/**
 * Request data from the server, add it to the graph and set a timeout to
 * request again
 */
function requestData() {
    $.ajax({
        url: 'fetch',
        success: function(users) {
            categories = _.pluck(users, 'name');
            // console.log(categories);;
            data = [];
            for (var i = 0, size = users.length; i < size; i++) {
                var user = users[i];
                // alternate colors, then repeat it if exceed the
                // highchart options
                data.push({
                    y: parseInt(user.tweets)
                });
            }
            // add the point
            chart.series[0].setData(data);
            chart.xAxis[0].setCategories(categories);
            chart.redraw();

            // call it again after five second
            setTimeout(requestData, 5000);
        },
        cache: false
    });
}

function getStartTime() {
    $.ajax({
        url: 'startTime',
        async: false,
        success: function(statStartTime) {
            startTime = statStartTime.time;
            console.log(startTime);
            // call it again after 1 min
            setTimeout(getStartTime, 60 * 1000);
        },
        cache: false
    });
}

function getTrends() {
    $.ajax({
        url: 'trends',
        success: function(trends) {
            $("#trends").empty();
            $("#trends").append($('<p>Currently trending twitter topics</p>'));
            _.each(trends, function(trend) {
                $("#trends").append($('<p><a href="http://www.twitter.com/search?q=' + escape(trend) + '" target="new">' + trend + '</a></p>'));
            });
            // call it again after three minutes
            setTimeout(getTrends, 3 * 60 * 1000);
        },
        cache: false
    });
}

function getTweetCount() {
    $.ajax({
        url: 'tweetCount',
        success: function(tweetCount) {
            $("#tweetCount").empty();
            $("#tweetCount").append($('<p>Total tweets received: ' + tweetCount + '</p>'));
            // call it again after 3 seconds
            setTimeout(getTweetCount, 3000);
        },
        cache: false
    });
}

$(document).ready(function() {
    getStartTime();
    getTrends();
    getTweetCount();
    $("#trends").corner();
    $("#container").corner();
    $("#messageBoard").corner();
    $("#dashboard").corner();
    chart = new Highcharts.Chart({
        chart: {
            renderTo: 'container',
            type: 'bar',
            events: {
                load: requestData
            }
        },

        title: {
            text: 'Tweet Masters since ' + startTime
        },

        xAxis: {
            title: {
                text: 'Twitter users'
            }
        },

        yAxis: {
            title: {
                text: 'No. of Tweets'
            }
        },

        series: [{
            name: 'Tweet Count',
            data: data,
            dataLabels: {
                enabled: true
            }
        }],
        
        exporting: {
            enabled: false
        },

        plotOptions: {
            series: {
                pointWidth: 20
            },
            bar: {
                events: {
                    click: function(event) {
                        window.open('http://www.twitter.com/' + event.point.category);
                    }
                }
            }
        }

    });
});