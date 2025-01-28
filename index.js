const express = require("express")
const multer = require("multer");
const cors = require("cors");
const ds = require('./service/dataservice');
const app = express()
app.use(cors({ origin: 'http://localhost:4200' }))
app.use(express.json())
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/customers",  upload.array("documents"), (req, res) => {
    const { name, email, phone, address,checkIn, checkOut } = req.body;
    const documents = req.files;
    console.log("checkinDtaes:",checkIn,checkOut)

    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
    }
    const processedDocuments = documents.map((file) => ({
      buffer: file.buffer, 
      mimetype: file.mimetype,
      originalname: file.originalname,
    }));

    ds.create(name, email, phone, address, processedDocuments,checkIn, checkOut)
        .then((result) => {
            res.status(result.statusCode).json(result);
        })
        .catch((error) => {
            res.status(500).json({ message: error.message });
        });
});

app.get("/customers", (req, res) => {
    ds.viewDetails()
        .then(result => {
            res.json(result)
        })
        .catch(error => {
            res.status(500).json({ message: error.message });
        });
})

  app.put('/customers/:id', upload.array('documents'), async (req, res) => {
    try {
      const { id } = req.params;
      const updatedData = req.body;
      console.log(req.body)
      const removedFiles = JSON.parse(req.body.removedFiles || '[]');
      const newFiles = req.files;
  
      const result = await ds.updateCustomer(id, updatedData, removedFiles, newFiles);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: 'Error updating customer', error: error.message });
    }
  });

  // app.get('/customers/:customerId/files/:fileId', async (req, res) => {
  //   try {
  //     const { customerId, fileId } = req.params;
  //     const file = await ds.getFile(customerId, fileId);
  
  //     if (!file) return res.status(404).send('File not found');
  
  //     res.setHeader('Content-Type', file.contentType);
  //     res.setHeader('Content-Disposition', 'inline');
  //     res.send(file.data);
  //   } catch (error) {
  //     res.status(500).send('Error retrieving file: ' + error.message);
  //   }
  // });
  
app.listen(3000, () => {
    console.log("server started at port 3000")
})
