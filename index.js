const express = require('express')

const dotenv = require('dotenv');

const { MongoClient, ServerApiVersion } = require('mongodb');

const cors = require("cors");
dotenv.config();


const uri = process.env.MONGODB_URI;


const app = express()
app.use(cors())
const port = process.env.PORT || 5000;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
   // await client.db("admin").command({ ping: 1 });




const db = client.db("PetTopia");
const petsCollection = db.collection("pets"); // 






app.get('/api/pets', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
   
    const pets = await petsCollection.find().limit(limit).toArray();
    res.send(pets);
  } catch (error) {
    res.status(500).send({ message: "Error fetching pets", error });
  }
});










    //search, filter, and sorting functionality for pets API

app.get('/pets', async (req, res) => {
  try {
    const { search, species, sort } = req.query;
    let query = {};

    
    if (search && search.trim() !== "") {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { breed: searchRegex }
      ];
    }

    if (species && species.trim() !== "") {
     
      query.species = { $regex: new RegExp(`^${species.trim()}$`, 'i') };
    }

  
    let sortOptions = {};
    if (sort === 'low-to-high') sortOptions.adoptionFee = 1;
    else if (sort === 'high-to-low') sortOptions.adoptionFee = -1;

    const result = await petsCollection.find(query).sort(sortOptions).toArray();
    
    console.log("Query sent to DB:", query); 
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Server Error", error });
  }
});










    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
  //  await client.close();
  }
}
run().catch(console.dir);





app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})