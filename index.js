const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));

app.use(express.json());





// MongoDB
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


const verifyToken = (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  next();
};


// const verifyToken = (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith("Bearer ")) {
//     return res.status(401).send({ message: "Unauthorized access" });
//   }
//   const token = authHeader.split(" ")[1];
  
//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//     if (err) return res.status(403).send({ message: "Forbidden access" });
//     req.user = decoded; 
//     next();
//   });
// };



  async function run() {
//  await client.connect();
  console.log("MongoDB Connected");

  const db = client.db("PetTopia");
  const petsCollection = db.collection("pets");
  const adoptionRequestsCollection = db.collection("adoptionRequests");

  //  PETS 
  
 

app.get("/pets", async (req, res) => {
  try {
    const { search, species, sort, limit } = req.query;

    let query = {};
    //  Search
    if (search && search.trim() !== "") {
      const regex = new RegExp(search, "i");

      query.$or = [
        { name: { $regex: regex } },
        { breed: { $regex: regex } },
        { species: { $regex: regex } },
      ];
    }

    // Species filter
    if (species && species.trim() !== "") {
      query.species = {
        $in: species.split(",").map((s) => s.trim()),
      };
    }

    // Sorting
    let sortOptions = { createdAt: -1 };

    if (sort === "low-to-high") sortOptions.adoptionFee = 1;
    if (sort === "high-to-low") sortOptions.adoptionFee = -1;
    if (sort === "latest") sortOptions.createdAt = -1;
    if (sort === "oldest") sortOptions.createdAt = 1;

   
    let cursor = petsCollection.find(query).sort(sortOptions);

    //  LIMIT (Home page 6 cards)
    if (limit) {
      cursor = cursor.limit(parseInt(limit));
    }

    const result = await cursor.toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});

  app.get("/pets/:id", async (req, res) => {
  try {
    const pet = await petsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!pet) {
      return res.status(404).send({
        message: "Pet not found",
      });
    }

    res.send(pet);
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});





 //  ADD PET
      app.post("/pets", verifyToken, async (req, res) => {
      try {
        const petData = req.body;
        petData.status = "available";
        petData.createdAt = new Date();
        const result = await petsCollection.insertOne(petData);
        res.send({ success: true, message: "Pet added successfully", result });
      } catch (error) {
        res.status(500).send({ success: false, message: "Failed to add pet" });
      }
    });

  
    app.put("/pets/:id", verifyToken, async (req, res) => {
      try {
        const updatedData = { ...req.body };
        delete updatedData._id;
        const result = await petsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updatedData }
        );
        res.send({ success: true, message: "Pet updated successfully", result });
      } catch (error) {
        res.status(500).send({ success: false, message: "Failed to update pet" });
      }
    });

 


    app.delete("/pets/:id", verifyToken, async (req, res) => {
      try {
        const result = await petsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.send({ success: true, message: "Pet deleted successfully", result });
      } catch (error) {
        res.status(500).send({ success: false, message: "Failed to delete pet" });
      }
    });

  // REQUESTS 
  

  app.post("/adoption-requests",verifyToken, async (req, res) => {
    const data = req.body;

    const result = await adoptionRequestsCollection.insertOne({
      ...data,
      status: "pending",
      createdAt: new Date(),
    });

    res.send(result);
  });


app.get("/my-pets/:email",verifyToken, async (req, res) => {
  console.log("EMAIL:", req.params.email);

  const pets = await petsCollection
    .find({
      ownerEmail: req.params.email,
    })
    .toArray();

  console.log("PETS:", pets);

  res.send(pets);
});


app.patch("/approve-request/:id",verifyToken, async (req, res) => {
  const request = await adoptionRequestsCollection.findOne({
    _id: new ObjectId(req.params.id),
  });

  if (!request) {
    return res.status(404).send({
      message: "Request not found",
    });
  }

  await adoptionRequestsCollection.updateOne(
    {
      _id: request._id,
    },
    {
      $set: {
        status: "approved",
      },
    }
  );

  await adoptionRequestsCollection.updateMany(
    {
      petId: request.petId,
      _id: {
        $ne: request._id,
      },
    },
    {
      $set: {
        status: "rejected",
      },
    }
  );

  await petsCollection.updateOne(
    {
      _id: new ObjectId(request.petId),
    },
    {
      $set: {
        status: "adopted",
        adopted: true,
      },
    }
  );

  res.send({
    success: true,
  });
});


app.get("/pet-requests/:petId",verifyToken, async (req, res) => {
  try {
    const requests = await adoptionRequestsCollection
      .find({
        petId: req.params.petId,
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(requests);

  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});

app.patch("/reject-request/:id",verifyToken, async (req, res) => {
  const result =
    await adoptionRequestsCollection.updateOne(
      {
        _id: new ObjectId(req.params.id),
      },
      {
        $set: {
          status: "rejected",
        },
      }
    );

  res.send(result);
});

  app.get("/my-requests/:email",verifyToken, async (req, res) => {
    const result = await adoptionRequestsCollection
      .find({ userEmail: req.params.email })
      .toArray();

    res.send(result);
  });


app.delete("/adoption-requests/:id",verifyToken, async (req, res) => {
  try {
    const result = await adoptionRequestsCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });

    res.send(result);
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});



app.get("/", (req, res) => {
    res.send("PetTopia Server is Running!");
  });
}
run().catch(console.dir);

app.listen(port, () => {
  console.log("Server running on port", port);
});