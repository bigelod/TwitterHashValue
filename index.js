// using free and open source Codebird library for Twitter access
// downloaded from https://github.com/jublonet/codebird-js
// the file codebird.js is included in the main HTML document as a script before this one

// Based on code by Dr. David Ogborn (d0kt0r0) from Avenue To Learn at McMaster University

var maxWidth = 800; //Canvas width
var maxHeight = 500; //Canvas height
var minRequestTime = 5; //How many seconds apart to request data, 5 minimum for user app
var dataUpdateTime = 10; //How many seconds to update data in? technically double, as we use an alternating update system (first pass to get data, second to update our system)

var graphTitle = "HashMarket: #"; //The title of the graphTitle
var liveGraphTitle = "Live Tag Value"; //The title of the live data graph
var historyGraphTitle = "Archived Tag Values"; //The title of the history data graph
var liveValue = "Current Tag Value:  "; //The live value of the tag
var lastLiveUpdate = "Last Update:  "; //When was data updated?
var tickerTitle = "Related Tags"; //The title of the ticker
var topHashesTitle = "Top Tags:"; //The top ten hashtags
var noArchiveTxt = "(no archived data)"; //Text when no archive data available
var noCurrentVal = "Loading..."; //Text when loading current value

var lastLiveDatestamp = ""; //When was it live last?

var tagQuery = "Apple"; //The first hashtag to look up, later replaced with current hashtag
var nextTag = ""; //The next tag to replace our current one with, "" if null

var rebuildTicker = false; //Rebuild the ticker?
var tickerText = ""; //The text scrolling across the bottom
var tickerMaxChars = 99; //Maximum characters before they are cycled again?
var tickerIndex = 0; //Index of the ticker cursor

var tickerScrollSpd = 3; //How many characters to jump at a time?
var tickerScrollTime = 1; //How many times to wait before scrolling one character?
var lastTickerTime = 0; //Last time we sent a ticker update in interval
var tickerYOff = 16; //Y offset of ticker from bottom

var singleTagMul = 0.025; //The value gain when a tag is the only tag in a tweet in a multiplier, very positive effect
var multiTagMul = 0.001; //The value loss when a tag is in a multi-tag tweet in a multiplier, negative effect

var hashValueBase = 1000; //Default value of a hashtag?
var hashMinVal = 0; //The smallest hash value we can get?
var hashMaxVal = 1000; //The largest hash value we can get?
var archiveMaxVal = 1000; //The largest hash value we can get for archive?

var liveChartYOff = 250; //Y offset to start the live chart at?
var liveChartXOff = 64; //X offset to start the live chart at?
var liveChartHeight = 128; //Y size of live chart?
var liveChartWidth = 650; //The width of the chart?
var lastVal = []; //The array of value for the hashtag over the past few updates
var lastTimes = []; //The last times we updated data
var nextLiveUpdate = 0; //How long till next?
var liveUpdateFreq = 10; //How many draw frames to update?
var nextLiveDatePost = 0; //How far till we put another date stamp?
var liveDateFreq = 96; //How often do we update the date? in pixels!

var archiveLastVal = []; //The archive data for this hashtag
var archiveDates = []; //Dates of the archive
var historyChartYOff = 410; //Y offset to start the history chart at?
var historyChartXOff = 64; //X offset to start the history chart at?
var historyChartHeight = 96; //Y size of live chart?
var historyChartWidth = 650; //Width of the history chart?

var hashObj = []; //An array of hashtag objects discovered which contains: HASHTAG (string), VALUE (hashValueBase at start, decreases or increases depending on use), DATE (current date of export), RELATED (is this related to the base tweet?)

var ans = []; //Start with a blank ans array

var sortHash = []; //An array of hashObjs sorted by VALUE

var startBuffer = ""; //Will be filled with blank spaces at setup
var startBufferMul = 2; //How many times to fill the buffer with spaces?
var endBuffer = " "; //The end blank space doesn't need to be filled, text will be off screen!

var lastID = []; //Last tweet ID to stop at for each search query

var censoredTweets = 0; //How many tweets have been censored?

var topNumToShow = 5; //How many top tweets to show?
var topXOff = 200; //X Offset from right for Top Tags List?
var topYOff = 24; //Y Offset from top for Top Tags List?

var isFirstPoll = true; //Is this the first poll? used to display the data
var doCensorCheck = true; //Ignore offensive hashtags?

function setup() {
	AudioContext = window.AudioContext || window.webkitAudioContext; // the line above sometimes help with browser-compatibility issues
	ac = new AudioContext();
	
	canvas = document.getElementById("myCanvas"); // find the canvas we already included via HTML below
	ctx = canvas.getContext("2d"); // get the drawing context for that canvas
	
	cb = new Codebird;
	cb.setConsumerKey(consumerKey,consumerSecret);
	cb.setToken(token,tokenSecret);
	console.log("setup finished.");
	
	for (var n = 0; n < Math.ceil(tickerMaxChars * startBufferMul); n++) {
		startBuffer = startBuffer + " ";
	}
	
	if (dataUpdateTime < minRequestTime) {
		//Just in case we try to update data faster than the API allows for
		dataUpdateTime = minRequestTime;
	}
	
	updateData(); //Check for data the first time to poll for data
	
	//Update archive
	loadTagArchive();
	
	myDisplayInterval = setInterval(function() { updateDisplay(); }, 100); //Update visual display every .1 seconds
	myDataInterval = setInterval(function() { updateData(); }, dataUpdateTime * 1000); //Check for data again every N seconds
	
	//Make enter key trigger the change tagQuery button
	//Based on http://stackoverflow.com/a/155263
	document.getElementById("tagbox").addEventListener("keydown", function(event) {
			if (event.keyCode == 13) {
				document.getElementById("tagbtn").click();
			}
		});
}

function updateData() {
	//If we have data, implement it, if not we get it, actually helps to decrease twitter serverload :)	
	if (ans != null && ans.length > 0) {
		//Now that we have new data (separated by status as ans[n].tweettags[i] we can update our data values!		
		for (var n = 0; n < ans.length; n++) {
			var loopTo = ans[n].tweettags.length;
			for (var i = 0; i < loopTo; i++) {
				//We now have our tags ready to add
				
				if (doCensorCheck) {
					//Actually we do one extra look to make sure they are allowed
					var theTag = ans[n].tweettags[i].toLowerCase();
					var foundBad = false;
					
					for (var x = 0; x < ignored.length; x++) {
						//Go through all our bad words
						if (theTag.indexOf(ignored[x]) > -1) {
							//We found a bad word, ignore this tag
							foundBad = true;
							break;
						}
					}
					
					if (!foundBad) {
						//This tag is okay, add it!
						updateHashTag(ans[n].tweettags[i], loopTo); //Pass the tag and how many other tags are in the tweet, will be updated automatically
					}
					else {
						//This is a bad tweet!
						censoredTweets = censoredTweets + 1; //Count how many have been censored so far, for internal use
					}
				}
				else {
					//We don't do any more checks, add it!
					updateHashTag(ans[n].tweettags[i], loopTo); //Pass the tag and how many other tags are in the tweet, will be updated automatically
				}
			}
		}
		
		//With data updated we can build our top ten list
		sortHash = hashObj;
		
		sortHash.sort(compareHash); //Sort using our compare function below ( based on http://stackoverflow.com/a/1129270 )
		
		var newDate = new Date();
			
		lastLiveDatestamp = newDate.getHours() + ":" + newDate.getMinutes() + ", " + newDate.getFullYear() + "/" + (newDate.getMonth() + 1) + "/" + newDate.getDate();
		
		rebuildTicker = true; //Data updated!
		
		ans = []; //Clear ans for the next request
	}
	else {
		//We don't have data right now, go get it!
		if (nextTag != "") {
			//We have a new tag to search for!
			tagQuery = nextTag;
			nextTag = "";
			document.getElementById("tagbtn").disabled = false;
	
			//Clear which tweets are related to the hashtag
			for (var h = 0; h < hashObj.length; h++) {
				hashObj[h].RELATED = false;
			}
			
			hashMaxVal = hashValueBase; //Reset the base value of the hashtag
	
			//Update archive
			loadTagArchive();
			
			lastVal = []; //Reset lastVal
			lastTimes = []; //Reset last times
			
			lastLiveDatestamp = "";
			
			isFirstPoll = true; //Treat this as the first poll so we post the timestamp
			rebuildTicker = true; //Data updated!
			
			nextLiveDatePost = 0; //Reset timer posting
		}
		
		searchHashTag(tagQuery);
	}
}


function updateDisplay() {
	//ctx.clearRect(0, 0, maxWidth, maxHeight);
	ctx.fillStyle = "black";
	ctx.strokeStyle = "white";
	ctx.fillRect(0, 0, maxWidth, maxHeight);
	
	//Draw the text at the top
	ctx.fillStyle = "white";
	ctx.font = "bold 24px Arial";
	ctx.fillText(graphTitle + tagQuery, 16, 32);
	
	var hashMax = "" + hashMaxVal + "";
	var archiveMax = "" + archiveMaxVal + "";
	
	//Draw current value text
	ctx.fillStyle = "white";
	ctx.font = "bold 18px Arial";
	ctx.fillText(liveValue, 16, 64);
	
	ctx.fillStyle = "white";
	ctx.font = "bold 12px Arial";
	ctx.fillText(lastLiveUpdate + lastLiveDatestamp, 16, 96);
	
	var foundOurHash = false; //Did we find it?
	
	//Update the live value chart, based on current data since opening
	for (var n = 0; n < hashObj.length; n++) {
		if (hashObj[n].HASHTAG.toLowerCase() == tagQuery.toLowerCase()) {
			//This is the hashTag we are mapping!
			foundOurHash = true; //Found it!
			
			if (hashObj[n].VALUE > hashMaxVal) {
				hashMaxVal = hashObj[n].VALUE + 500; //Update our max value
			}
			
			var hashVal = Math.round(hashObj[n].VALUE); //Hash value
			
			//Draw current value
			if (hashVal >= 1000) {
				ctx.fillStyle = "green";
			}
			else {
				ctx.fillStyle = "red";
			}
			
			ctx.font = "bold 18px Arial";
			ctx.fillText(hashVal, 16 + ((liveValue.length + 1) * 8), 64);
			
			if (nextLiveUpdate % liveUpdateFreq == 0 && nextLiveUpdate != 0) {
				//A delayed update of values
				
				if (lastVal.length > liveChartWidth) {
					//Shift all items backwards
					lastVal.splice(0, 1); //Cut the first (oldest) item off
					lastTimes.splice(0, 1); //Cut the first (oldest) date off
				}
				
				var newVal = scale(hashMinVal, hashMaxVal, 0, liveChartHeight, hashObj[n].VALUE);
				
				lastVal.push(newVal);
				
				if (nextLiveDatePost % liveDateFreq == 0 && nextLiveDatePost != 0) {
					var curDate = new Date();
					
					var curHour = curDate.getHours();
					var curMinutes = curDate.getMinutes();
					var curSeconds = curDate.getSeconds();
					
					if (curHour < 10) {
						curHour = "0" + curHour;
					}
					
					if (curMinutes < 10) {
						curMinutes = "0" + curMinutes;
					}
					
					if (curSeconds < 10) {
						curSeconds = "0" + curSeconds;
					}
					
					lastTimes.push(curHour + ":" + curMinutes + ":" + curSeconds);
					
					nextLiveDatePost = 0; //Reset check
				} else {
					//Not time to add a date to the list yet
					nextLiveDatePost = nextLiveDatePost + 1;
					
					if (lastVal.length == 1) {
						//Actually, the first entry gets a timestamp!
						var curDate = new Date();
										
						var curHour = curDate.getHours();
						var curMinutes = curDate.getMinutes();
						var curSeconds = curDate.getSeconds();
						
						if (curHour < 10) {
							curHour = "0" + curHour;
						}
						
						if (curMinutes < 10) {
							curMinutes = "0" + curMinutes;
						}
						
						if (curSeconds < 10) {
							curSeconds = "0" + curSeconds;
						}
						
						lastTimes.push(curHour + ":" + curMinutes + ":" + curSeconds);
					}
					else {
						lastTimes.push("");
					}
				}
				
				
				nextLiveUpdate = 0; //Reset check
			}
			else {
				//Not time to update the live display yet
				nextLiveUpdate = nextLiveUpdate + 1;
			}
			
			for (var i = 0; i < lastVal.length; i++) {
				ctx.fillStyle = "white";
				
				var pointX = liveChartXOff + i;
				var pointY = liveChartYOff - lastVal[i];
				
				if (i == 0) {
					//The first point
					ctx.fillRect(pointX, pointY, 1, 1);
				}
				else {
					//All subsequent points
					ctx.lineWidth = 3;
					drawLine(pointX - 1, liveChartYOff - lastVal[i-1], pointX, pointY);
				}
				
				//Do the time value text below each point if it exists
				if (lastTimes[i] != "") {
					
					if (i == 0 && lastVal.length < liveChartWidth) {
						pointX = pointX + 16;
					}
					
					ctx.fillStyle = "white";
					ctx.font = "12px Arial";
					ctx.fillText(lastTimes[i], pointX - 16, liveChartYOff + 14);
				}
			}
			
			break;
		}
	}
	
	if (hashObj.length <= 0 || !foundOurHash) {
		//No data (yet?)
		ctx.fillStyle = "white";
		ctx.font = "bold 18px Arial";
		ctx.fillText(noCurrentVal, 16 + ((liveValue.length + 1) * 8), 64)
	}
	
	if (lastLiveDatestamp == "") {
		//No value
		ctx.fillStyle = "white";
		ctx.font = "bold 12px Arial";
		ctx.fillText(noCurrentVal, 16 + ((lastLiveUpdate.length + 1) * 5), 96)
	}
	
	ctx.fillStyle = "white";
	ctx.font = "12px Arial";
	ctx.fillText(hashMax, liveChartXOff - (8 * hashMax.length), liveChartYOff - liveChartHeight + 8);
	ctx.fillText("0", liveChartXOff - 12, liveChartYOff + 8);
	ctx.font = "bold 18px Arial";	
	ctx.fillText(liveGraphTitle, (maxWidth / 2) - (liveGraphTitle.length * 5), liveChartYOff - liveChartHeight - 16);
	
	drawGrid(liveChartXOff, liveChartYOff, liveChartWidth, liveChartHeight); //Draw our grid
	
	//Update the history chart, based on manually created archive data calculated once per tag
	ctx.fillStyle = "white";
	var pointGap = Math.ceil((historyChartWidth - 12) / (archiveLastVal.length - 1)); //The gap between points
	
	if (archiveLastVal.length <= 0) {
		//We have no data in archive!
		ctx.font = "bold 18px Arial";
		ctx.fillText(noArchiveTxt, (maxWidth / 2) - (noArchiveTxt.length * 5), historyChartYOff - (historyChartHeight/2));
	}
	
	for (var h = 0; h < archiveLastVal.length; h++) {
		
		var pointX = historyChartXOff + (h * pointGap);
		var pointY = historyChartYOff - archiveLastVal[h];
		
		if (h == 0) {
			//The first point
			ctx.fillRect(pointX, pointY, 1, 1);
		}
		else {
			//All subsequent points
			ctx.lineWidth = 3;
			drawLine(pointX - pointGap, historyChartYOff - archiveLastVal[h-1], pointX, pointY);
		}
		
		//Draw the date under each one
		ctx.fillStyle = "white";
		ctx.font = "12px Arial";
		
		if (h == 0) {
			pointX = pointX + 16;
		}
		
		if (h == archiveLastVal.length - 1) {
			pointX = pointX - 24;
		}
		
		ctx.fillText(archiveDates[h], pointX - 16, historyChartYOff + 14);
	}
	
	ctx.fillStyle = "white";
	ctx.font = "12px Arial";
	ctx.fillText(archiveMax, historyChartXOff - (8 * archiveMax.length), historyChartYOff - historyChartHeight + 8);
	ctx.fillText("0", historyChartXOff - 12, historyChartYOff + 8);
	ctx.font = "bold 18px Arial";
	ctx.fillText(historyGraphTitle, (maxWidth / 2) - (historyGraphTitle.length * 5), historyChartYOff - historyChartHeight - 16);
	
	drawGrid(historyChartXOff, historyChartYOff, historyChartWidth, historyChartHeight); //Draw our grid
	
	//Update the ticker
	if (rebuildTicker) {
		//Rebuild the ticker text
		tickerText = startBuffer; //Padding on the start
		
		var addTickerTextEnd = false;
		
		//tickerText = tickerText + "Apple: 100, Microsoft: 1000, Mac OSX: 0.91";
		for (var t = 0; t < hashObj.length; t++) {
			//Loop through each of the tags and add them to the ticker tape
			if (hashObj[t].RELATED) {
				//This is related to the base tweet
				if (addTickerTextEnd) {
					tickerText = tickerText + ", ";
				}
				
				tickerText = tickerText + hashObj[t].HASHTAG + ": " + hashObj[t].VALUE;
			
				addTickerTextEnd = true; //Next time we get here, start with a comma!
			}
		}
		
		
		tickerText = tickerText + endBuffer; //Padding on the end
		
		rebuildTicker = false;
	}
	
	if (tickerIndex >= tickerText.length) tickerIndex = 0; //Start at the beginning again
	
	if (lastTickerTime > tickerScrollTime) {
		//We've waited long enough, move ahead!
		if (tickerText.length > tickerMaxChars) {
			tickerIndex += tickerScrollSpd; //Actually only move ahead if there is more text than we can fit in a line
			if (tickerIndex > tickerText.length) tickerIndex = tickerText.length; //Don't jump too far!
		}
		else {
			tickerIndex = 0; //Otherwise just stay where we are
		}
		
		lastTickerTime = 0;
	}
	else {
		lastTickerTime = lastTickerTime + 1;
	}
	
	var drawText = tickerText.substr(tickerIndex); //The actual drawn text
	
	//Draw the ticker title
	ctx.fillStyle = "white";
	ctx.font = "bold 18px Arial";
	ctx.fillText(tickerTitle, (maxWidth / 2) - (tickerTitle.length * 5), maxHeight - tickerYOff - 30);
	
	//Draw the ticker text
	ctx.fillStyle = "white";
	ctx.font = "bold 18px Arial";
	ctx.fillText(drawText, 2, maxHeight - tickerYOff);
	
	//Now we draw the top-ten list
	ctx.fillStyle = "white";
	ctx.font = "bold 18px Arial";
	ctx.fillText(topHashesTitle, maxWidth - topXOff, topYOff);
	
	ctx.fillStyle = "white";
	ctx.font = "12px Arial";
	
	var numSortTags = topNumToShow;
	if (numSortTags > sortHash.length) numSortTags = sortHash.length;
	var topListYOff = topYOff + 24;
	
	for (var z = 0; z < numSortTags; z++) {
		var hashText = sortHash[z].HASHTAG + ": " + Math.round(sortHash[z].VALUE);
		ctx.fillText(hashText, maxWidth - topXOff, topListYOff + z * 16);
	}
}

//Load up the archive for a new tag
function loadTagArchive() {
	archiveLastVal = [];
	archiveDates = [];
	
	archiveMaxVal = hashValueBase; //Reset max value
	
	for (var h = 0; h < archive.length; h++) {
		if (archive[h].HASHTAG.toLowerCase() == tagQuery.toLowerCase()) {
			//This is the hashTag we are mapping
			if (archive[h].VALUE > archiveMaxVal) {
				archiveMaxVal = archive[h].VALUE + 500; //Update our max value
			}
			
			var newVal = scale(hashMinVal, archiveMaxVal, 0, historyChartHeight, archive[h].VALUE);
			
			archiveLastVal.push(newVal);
			
			var newDate = new Date(archive[h].DATE);
			
			var dateStr = newDate.getFullYear() + "/" + (newDate.getMonth() + 1) + "/" + newDate.getDate();
			
			archiveDates.push(dateStr); //Push the date into memory
		}
	}
}

//Search for tweets using our hashtag
function searchHashTag(tag) {
	ans = new Array; //Set the array to store the data into
	
	var search = "%23" + tag;
	var nextLastID = ""; //Will be updated at end of update
	var tagLowercase = tag.toLowerCase(); //Lowercase version of tag, to avoid duplication of ID checking
	
	cb.__call("search_tweets", {q:search, count:100, result_type:"recent"}, function(reply) {
		var loopTo = 0;
		if (reply.statuses != null) loopTo = reply.statuses.length;
		var lastIDIndex = -1;
		
		for (var x = 0; x < lastID.length; x++) { 
			//Find the ID belonging to our last ID
			if (lastID[x].TAG == tagLowercase) {
				//We have it!
				lastIDIndex = x;
				break; //Continue on
			}
		}
		
		for (var n = 0; n < loopTo; n++) {
			//Looping through each status
			var taglist = reply.statuses[n].entities.hashtags; //Get the tags
			var tweettags = new Array; //An array of tweets with tags
			test = reply;
			if (lastIDIndex != -1) {
				//We have a last ID for this search, might need to break!
				if (lastID[lastIDIndex].ID == reply.statuses[n].id_str) {
					break; //We've gotten here before, so we can end our loop here
				}
			}
			
			if (n == 0) {
				//First tweet in the queue becomes our lastID if we are still here
				nextLastID = reply.statuses[n].id_str; //Store the last ID for next time
			}
			
			for (var i = 0; i < taglist.length; i++) {
				var t = taglist[i].text; //Get the hashtags used
				
				tweettags.push(t);
			}
			
			ans.push({ tweettags }); //Add it to array
		}
		
		if (nextLastID != "") {
			//We found a new lastID
			var lastIDObj = {TAG : tagLowercase, ID : nextLastID};
			
			if (lastIDIndex == -1) {
				//Create a new tag last index reminder!
				lastID.push(lastIDObj);
			}
			else {
				//Update existing
				lastID[lastIDIndex] = lastIDObj;
			}
		}
		
		if (isFirstPoll) {
			//Is this the first time it's being called?
			updateData(); //Load data into memory
			isFirstPoll = false; //No longer the first poll
		}
	});
}

//Update data array with a hashtag
function updateHashTag(tag, tagsintweet) {
	//console.log(tag + ", " + tagsintweet);
	
	var date = new Date(); //Load the date now to a variable
	var haveIt = false; //Do we have this?
	var foundAt = 0; //Index it was found at
	
	//Check tags if they exist, if not add it with value hashValueBase to start!
	for (var t = 0; t < hashObj.length; t++) {
		if (hashObj[t].HASHTAG.toLowerCase() == tag.toLowerCase()) {
			hashObj[t].RELATED = true; //It's still related!
			haveIt = true; //We already have it
			foundAt = t; //The index it was found at
			break;
		}
	}
	
	if (!haveIt) {
		//Time to add it
		//HASHTAG (string), VALUE (hashValueBase at start, decreases or increases depending on use), DATE (current date of export), RELATED (is this related to the base tweet?)
		var newtag = { HASHTAG : tag, VALUE : hashValueBase, DATE : date.toDateString(), RELATED : true};
		hashObj.push(newtag); //Add it to the array
		foundAt = hashObj.length - 1; //Get the index of it
	}
	
	//Finally, multiply the tag value by whether or not it was on its own as a tag, or other tags were present)
	if (tagsintweet == 1) {
		//Positive impact on the hashtag value
		hashObj[foundAt].VALUE = hashObj[foundAt].VALUE + (hashObj[foundAt].VALUE * singleTagMul);
	}
	else {
		//Negatively impact the hashtag value, more harsh with how many other tags are in the tweet
		hashObj[foundAt].VALUE = hashObj[foundAt].VALUE - (hashObj[foundAt].VALUE * multiTagMul * tagsintweet);
	}
	
	hashObj[foundAt].VALUE = Math.round(hashObj[foundAt].VALUE);
	
	
	//Store the date of when it was last updated too
	var dateStr = date.toDateString();
	
	hashObj[foundAt].DATE = dateStr;
}

//A function to draw a grid on the canvas
function drawGrid(x, y, w, h) {
	ctx.fillStyle = "white";
	ctx.lineWidth = 1;	
		
	ctx.beginPath();
	ctx.moveTo(x, y); //Start from top-left of chart
	ctx.lineTo(x, y - h); //Row line
	ctx.moveTo(x, y); //Re-position start point
	ctx.lineTo(x + w, y); //Column line
	ctx.closePath();
	
	ctx.stroke();
}

//A function to draw a line from two points
function drawLine(x1, y1, x2, y2) {
	ctx.beginPath();
	ctx.moveTo(x1, y1); //Start from top-left of chart
	ctx.lineTo(x2, y2); //Row line
	ctx.closePath();
	ctx.stroke();
}

//Change the tag we are searching for now
function changeTag() {
	var newTag = document.getElementById("tagbox").value; //Store the value in the textbox
	
	nextTag = newTag; //Load it in for next update
	
	document.getElementById("tagbtn").disabled = true; //Disable the button for now
}

//A function for exporting the data to be used in the archive
function exportData() {
	
	var expdata = "";
	expdata = expdata + "archive = [";
	
	for (var i = 0; i < archive.length; i++) {
		//Loop through and add the existing archive data if the date is not the same as todays data
		
		if (archive[i].DATE != hashObj[0].DATE) {
			//Confirmed not to be todays/the starting date of the app
		
			expdata = expdata + prettyPrint(archive[i]);
			
			expdata = expdata + ", "; //Always put a comma because the next section will need it anyway
		}
	}
	
	for (var n = 0; n < hashObj.length; n++) {
		//Loop through and add todays data
		var hashExp = hashObj[n];
		
		delete hashExp.RELATED; //Remove if the hashtag is related since we don't need that in the archive
		
		expdata = expdata + prettyPrint(hashExp);
		
		if (n < hashObj.length - 1) {
			expdata = expdata + ", ";
		}
	}
	
	expdata = expdata + "];";
	
	//console.log(expdata);
	copyToClipboard(expdata);
}

//Helper function from: http://stackoverflow.com/a/6055620
function copyToClipboard(text) {
  window.prompt("Copy to clipboard: Ctrl+C, Enter", text);
}

// a function to a JavaScript object into pretty-printed, complete JSON
// so we can, for example, print everything in an object to the log window
// for copying and pasting data back to a text editor
function prettyPrint(x) {
  return JSON.stringify(x,null,2);
}

function boundCheck(chkx, chky, x, y, width, height) {
	//Check if an X and Y co-ordinate is within any shape of box
	if (chkx > x - width/2 && chkx < x + width/2) {
		if (chky > y - height/2 && chky < y + height/2) {
			return true;
		}
	}
	
	return false;
}

// some convenience functions from/based on http://www.d0kt0r0.net/teaching/javascript-scheduling-and-mapping-strategies.html
scale = function(min1,max1,min2,max2,value) { return (value-min1)/(max1-min1)*(max2-min2)+min2;};

function clamp(min, max, val) {
	if (val < min) return min;
	if (val > max) return max;
	return val;
}

//A function used to sort hashObj by VALUE
//Based on http://stackoverflow.com/a/1129270
function compareHash(hash1, hash2) {
	if (hash1.VALUE < hash2.VALUE) {
		return 1; //This is less valuable, push it to the end of array
	}
	if (hash1.VALUE > hash2.VALUE) {
		return -1; //This is more valuable, push it to the start of the array
	}
	
	return 0; //Same value
}