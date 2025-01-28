const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/customerrecords", { useNewUrlParser: true });

const Customer = mongoose.model("Customer", {
    name: String,
    email: String,
    phone: Number,
    address: String,
    documents: [
        {
            fileId: String, // Google Drive File ID
            fileName: String,
            fileLink: String, // Google Drive Public Link
        }  
    ],
    checkInDates: [{
      checkInDate: { type: Date, required: true },
      checkOutDate: { 
          type: Date, 
          required: true, 
          validate: {
              validator: function(value) {
                  return value > this.checkInDate;
              },
              message: "Check-out date must be after check-in date."
          }
      }
  }]
});

module.exports = { Customer };
