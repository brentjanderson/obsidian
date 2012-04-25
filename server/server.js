// See http://mongoosejs.com for more information.
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/obsidian');

var Schema = mongoose.Schema;

var PropertySchema = new Schema({
    key               : String
  , value             : String
  , collection_id     : Number
});

// Instantiate our server
var io = require('socket.io').listen(8888);

var socketCache = [];

// Establish the connection
io.sockets.on('connection', function (socket) {
    socket.on('register', function(data) {
        socketCache.push([socket, data['collection_id']]);
    });
    
    // When we receive a netCommit from a client //
    socket.on('netCommit', function (data) {
        // Create the property object for a collection with each collection's id on the end //
        // This keeps data per collection separate //
        Property = mongoose.model('Property'+data['collection_id'], PropertySchema);
        
        // Find the property based on property and collection ID. When it's successful... //
        Property.findOne({key: data['property'], collection_id: data['collection_id'] }, function(err, property) {
            // If the property does not exist...
            if (property == null) {
                // Create an instance of it with our key values //
                property = new Property( {key: data['property'], collection_id: data['collection_id'] });
            }
            
            // Don't fire updates if the values are the same //
            if (property.value != data['value']) {
                for (i in socketCache) {
                    if (socketCache[i][1] == data['collection_id']) {
                        socketCache[i][0].emit('netUpdate', { key: data['property'], value: data['value'], collection_id: data['collection_id'] });
                    }
                }
                
                // Update our property object with the new value that was committed //
                property.value = data['value'];
                // Save the property to the database //
                property.save( function(err) {
                    if (err) { console.log(err); }
                    console.log('Updated property ', data['property']);
                });
            }
        
        });
        
    });
  
    // When a client subscribes, it asks for the current value of a property //
    socket.on('netRefresh', function (data) {
	Property = mongoose.model('Property'+data['collection_id'], PropertySchema);
        console.log('netRefresh called');
        // Find the property in question //
        Property.findOne( {key: data['property'], collection_id: data['collection_id'] } , function(err, property) {

            // If the property doesn't exist, return null
            if (property == null) {
                returnVal = null;
            } else { // Otherwise, return it's normal value
                returnVal = property.value;
            }
            
            // Fire back to the client a netUpdate message
            socket.emit('netUpdate', { key: data['property'], value: returnVal, collection_id: data['collection_id'] });
        });
    });
    
    socket.on('disconnect', function () {
        // Prune closed socket from socketCache //
        for (i in socketCache) {
            if (socketCache[i][0] == socket) {
                socketCache.splice(i,1);
                continue;
            }
        }
        console.log('Client disconnected');
        io.sockets.emit('Client disconnected');
    });
});
