const { Readable } = require("stream"); // ✅ Import Readable

const { google } = require("googleapis");
const db = require("./db");

// Path to your Google service account credentials
const path = require("path"); // ✅ Import path module
const KEYFILEPATH = path.join(__dirname, "../customerrecords-7ce19a477b7a.json"); // ✅ Correct absolute path
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

// Initialize Google Auth and Drive API client
const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
});

const drive = google.drive({ version: "v3", auth });

// Upload file to Google Drive
const uploadToDrive = async (file) => {
    try {
        // console.log("Uploading file to Google Drive:", file);

        if (!file || !file.buffer || !file.mimetype || !file.originalname) {
            console.error("Invalid file data:", file);
            throw new Error("Invalid file data received for upload.");
        }

        const fileMetadata = {
            name: file.originalname,
            parents: ["1Q4XFyTvS-AwGExPNbxy89AMpFd2PEs9S"], // Replace with your Drive folder ID
        };
        // console.log("Using Folder ID:", fileMetadata.parents[0]);
        // ✅ Convert Buffer to Readable Stream using Readable.from()
        const bufferStream = Readable.from(file.buffer);

        const media = {
            mimeType: file.mimetype,
            body: bufferStream, // ✅ Use proper stream
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: "id, webViewLink",
        });

        // console.log("File uploaded successfully:", response.data);
        return {
            fileId: response.data.id,
            fileName: file.originalname,
            fileLink: response.data.webViewLink,
        };
    } catch (error) {
        // console.error("Error uploading file to Google Drive:", error.message);
        throw new Error("Failed to upload file");
    }
};
// Create new customer and store documents in Google Drive
const create = async (name, email, phone, address, documents, checkIn, checkOut) => {
    console.log("Received dates:", checkIn, checkOut);
    try {
        if (!checkIn || !checkOut) {
            return { status: false, message: "Check-in and check-out dates are required.", statusCode: 400 };
        }
        // Convert received dates to JavaScript Date objects
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        if (Number.isNaN(checkInDate) || Number.isNaN(checkOutDate)) {
            return{ status: false,message: "Invalid check-in or check-out date.",statusCode: 400};
        }

        // Ensure check-out date is after check-in date
        if (checkOutDate <= checkInDate) {
            return {status: false,message: "Check-out date must be after check-in date.",statusCode: 400 };
        }

        // Upload each document to Google Drive
        const uploadedDocs = await Promise.all(
            documents.map(uploadToDrive)
        );

        // Create new customer and store the Google Drive file links
        const newCustomer = new db.Customer({
            name,
            email,
            phone,
            address,
            documents: uploadedDocs.map((doc) => ({
                fileId: doc.fileId,
                fileName: doc.fileName,
                fileLink: doc.fileLink,
            })),
            checkInDates: [{ checkInDate, checkOutDate }]
        });

        // Save customer details to MongoDB
        await newCustomer.save();

        return { status: true, message: "Customer details added", statusCode: 200 };
    } catch (error) {
        console.error("Error saving customer:", error.message);
        throw new Error(error.message);
    }
};

// View customer details and fetch file links
const viewDetails = () => {
    return db.Customer.find() .sort({ "checkInDate": -1 }).then((customers) => {
        return customers.map((customer) => ({
            ...customer._doc,
            documents: customer.documents.map((doc) => ({
                fileId: doc.fileId,
                fileName: doc.fileName,
                fileLink: doc.fileLink, // Include the file link from Google Drive
            })),
            checkInDates: customer.checkInDates.map((date) => ({
                checkIn: date.checkInDate,
                checkOut: date.checkOutDate
            }))
        }));
    }).catch((error) => {
        throw error;
    });
};

// Update customer details and handle document uploads
const updateCustomer = async (id, updatedData, removedFiles, newFiles) => {
    try {
        let customer = await db.Customer.findById(id);
        if (!customer) throw new Error("Customer not found");

        // Remove specified files
        customer.documents = customer.documents.filter(
            (doc) => !removedFiles.includes(doc.fileId)
        );

        // Upload and add new files
        if (newFiles && newFiles.length > 0) {
            const newDocuments = await Promise.all(
                newFiles.map(uploadToDrive)
            );
            customer.documents = [
                ...customer.documents,
                ...newDocuments.map((doc) => ({
                    fileId: doc.fileId,
                    fileName: doc.fileName,
                    fileLink: doc.fileLink,
                })),
            ];
        }

        // Update customer info
        customer.name = updatedData.name;
        customer.email = updatedData.email;
        customer.phone = updatedData.phone;
        customer.address = updatedData.address;
        if (updatedData.checkIn && updatedData.checkOut) {
            const checkInDate = new Date(updatedData.checkIn);
            const checkOutDate = new Date(updatedData.checkOut);
            console.log("dates",checkInDate,checkOutDate)
            // Validate dates
            if (isNaN(checkInDate) || isNaN(checkOutDate)) {
                throw new Error("Invalid check-in or check-out date.");
            }
            if (checkOutDate <= checkInDate) {
                throw new Error("Check-out date must be after check-in date.");
            }

            // Append new check-in and check-out date to array
            customer.checkInDates.push({
                checkInDate,
                checkOutDate,
            });
        }
        await customer.save();

        return { message: "Customer updated successfully", customer };
    } catch (error) {
        console.error("Error updating customer:", error.message);
        throw new Error(error.message);
    }
};

// Get a specific file from Google Drive (using file ID)
const getFile = async (customerId, fileId) => {
    try {
        const customer = await db.Customer.findById(customerId);
        if (!customer) return null;

        const fileDoc = customer.documents.find(
            (doc) => doc.fileId === fileId
        );
        if (!fileDoc) return null;

        return fileDoc;
    } catch (error) {
        throw new Error(error.message);
    }
};

module.exports = {
    create,
    viewDetails,
    updateCustomer,
    getFile,
    uploadToDrive
};
