// Setup socket connection 
var socket = io.connect('http://127.0.0.1:8888');

// Used to track local subscriptions //
var subscribers = new Array();
var core_collectionID = 0; // Used to set up separate collections of data

var propertyCache = [];

function netRequest(theKey) {
    for (var i =0; i < propertyCache.length; i++) {
        if (propertyCache[i][0] == theKey) {
            return propertyCache[i][1];
        }
    }
    return null;
}

// Track netUpdate messages //
// // Received when a property is updated elsewhere and we need to respond //
socket.on('netUpdate', function (data) {
    if (data['collection_id'] == core_collectionID) {
        // Callback for netUpdate messages //
        netUpdate(data['key'], data['value']);
    }
});

// Iterate through subscriber list, fire corresponding messages passing theValue as the result //
function netUpdate(theKey, theValue) {
    // Try to serialize JSON values (like arrays, objects, etc.
    try {
        newValue = JSON.parse(theValue);
    } catch(e) {
        newValue = theValue;
    }
    theValue = newValue;
    
    for (var i=0; i < subscribers.length; i++) {
        if (subscribers[i][0] == theKey) {
            subscribers[i][1](theValue);
        }
    }
    
    // Save to propertyCache for netRequests
    foundProp = false;
    for (var i=0; i < propertyCache.length; i++) {
        if (propertyCache[i][0] == theKey) {
            foundProp = true;
            propertyCache[i][1] = theValue;
            continue;
        }
    }
    // If we didn't find the property in our loop, then add it to the cache
    if (foundProp == false) {
        propertyCache.push(new Array(theKey, theValue));
    }
}

// Post an update to push database for broadcasting //
function netCommit(theKey, theValue) {
    theValue = JSON.stringify(theValue);
    socket.emit('netCommit', { property: theKey, value: theValue, collection_id: core_collectionID });
}

// Start listening for a particular key; when updated, fire callback
// If you don't want a callback to be called immediately, set noCallbackBack to true
function netSubscribe(theKey, callback, noCallbackNow) {
    setSubscriber = true;
    // Iterate through subscribers list to find if we already have subscribed for this //
    for (var i=0; i < subscribers.length; i++) {
        // If we've already subscribed, then don't subscribe //
        if(subscribers[i][0] == theKey && subscribers[i][1] == callback) {
            setSubscriber = false;
            continue;
        }
    }
    
    // If we are going to set a unique subscriber //
    if (setSubscriber) {
        // Add the key and the callback to the subscribers //
        subscribers.push(new Array(theKey, callback));
    }
    
    // If we're going to fire a callback, then ask the server to send us a refresh //
    if (noCallbackNow != true) {
        socket.emit('netRefresh', { property: theKey, collection_id: core_collectionID });
    }
}

// Find a key and callback function pair; remove if found //
function netUnsubscribe(theKey, callback) {
    for (var i=subscribers.length-1; i >= 0; i--) {
        if (subscribers[i][0] == theKey && subscribers[i][1] == callback) {
            subscribers.splice(i, 1);
        } else if (subscribers[i][0] == theKey && callback == null) {
            subscribers.splice(i, 1);
        } else if (theKey == null && callback == null) {
            subscribers.splice(i, 1);
        }
    }
}

// Register this client as associated with this particular collection
socket.emit('register', {collection_id: core_collectionID});