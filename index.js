const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

// JWT Verify Middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).send({ message: "Unauthorized Access" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).send({ message: "Forbidden Access" });
  }
};

async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected Successfully");

    const db = client.db("PetTopia");

    const petsCollection = db.collection("pets");
    const usersCollection = db.collection("users");
    const adoptionRequestsCollection =
    db.collection("adoptionRequests");

  
    // AUTH ROUTES
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword, photoURL } = req.body;

    // 1. Required fields check
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).send({
        success: false,
        message: "All fields are required",
      });
    }

    // 2. Normalize values (IMPORTANT FIX)
    const safeEmail = String(email).trim().toLowerCase();
    const safePassword = String(password);
    const safeConfirm = String(confirmPassword);

    // 3. Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(safeEmail)) {
      return res.status(400).send({
        success: false,
        message: "Invalid email format",
      });
    }

    
    // 4. Password match check
  
    if (safePassword !== safeConfirm) {
      return res.status(400).send({
        success: false,
        message: "Passwords do not match",
      });
    }

 
    // 5. Password strength check
    if (safePassword.length < 6) {
      return res.status(400).send({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // 6. Check existing user
   
    const existingUser = await usersCollection.findOne({
      email: safeEmail,
    });

    if (existingUser) {
      return res.status(400).send({
        success: false,
        message: "User already exists",
      });
    }

    // =========================
    // 7. Hash password
    // =========================
    const hashedPassword = await bcrypt.hash(safePassword, 10);

    // =========================
    // 8. Save user
    // =========================
    const result = await usersCollection.insertOne({
      name,
      email: safeEmail,
      password: hashedPassword,
      photoURL: photoURL || "",
      role: "user", 
      createdAt: new Date(),
    });

    return res.status(201).send({
      success: true,
      message: "Registered successfully",
      userId: result.insertedId,
    });
  } catch (error) {
    console.error("Register Error:", error);

    return res.status(500).send({
      success: false,
      message: "Server error during registration",
    });
  }
});



    app.post("/api/auth/login", async (req, res) => {
      const { email, password } = req.body;
      const user = await usersCollection.findOne({ email });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).send({ message: "Invalid Credentials" });
      }




      const token = jwt.sign({ email: user.email, name: user.name,  role: user.role}, process.env.JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, { httpOnly: true, secure: false, sameSite: "lax" });
      res.send({ success: true, user: { name: user.name, email: user.email, photoURL: user.photoURL } });
    });



    app.get("/api/auth/get-session", verifyToken, async (req, res) => {
      const user = await usersCollection.findOne({ email: req.user.email });
      user ? res.send({ user }) : res.status(404).send({ message: "User Not Found" });
    });



    app.post("/api/auth/logout", (req, res) => {
      res.clearCookie("token").send({ success: true });
    });



    
    // PET ROUTES
    
    app.get("/api/pets", async (req, res) => {
      const limit = parseInt(req.query.limit) || 6;
      const pets = await petsCollection.find().limit(limit).toArray();
      res.send(pets);
    });


   // Search, Filter & Sorting Functionality for Pets API

app.get("/pets", async (req, res) => {
  try {
    const { search, species, sort } = req.query;

    let query = {};

   
    // Search by pet name/breed/species
    // Using MongoDB $regex
   

    if (search && search.trim() !== "") {
      const searchRegex = new RegExp(search, "i");

      query.$or = [
        {
          name: {
            $regex: searchRegex,
          },
        },
        {
          breed: {
            $regex: searchRegex,
          },
        },
        {
          species: {
            $regex: searchRegex,
          },
        },
      ];
    }

    // =========================
    // Filter by species
    // Using MongoDB $in
    // =========================

    if (species && species.trim() !== "") {
      const speciesArray = species
        .split(",")
        .map((item) => item.trim());

      query.species = {
        $in: speciesArray,
      };
    }

    // =========================
    // Sorting Options
    // =========================

    let sortOptions = {};

    switch (sort) {
      case "low-to-high":
        sortOptions.adoptionFee = 1;
        break;

      case "high-to-low":
        sortOptions.adoptionFee = -1;
        break;

      case "latest":
        sortOptions.createdAt = -1;
        break;

      case "oldest":
        sortOptions.createdAt = 1;
        break;

      default:
        sortOptions.createdAt = -1;
    }

   
    // Fetch Data
   

    const result = await petsCollection
      .find(query)
      .sort(sortOptions)
      .toArray();

    console.log("Database Query:", query);

    res.status(200).send(result);
  } catch (error) {
    console.error("Pets Fetch Error:", error);

    res.status(500).send({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
});


//Add Pet Route
app.post("/pets", async (req, res) => {
  try {
    const petData = req.body;

    const result =
      await petsCollection.insertOne({
        ...petData,
        adopted: false,
        status: "available",
        createdAt: new Date(),
        });

    res.send(result);
  } catch (error) {
    res.status(500).send(error);
  }
});



//My Listings
app.get("/my-pets/:email",async (req, res) => {
  try {
    const email = req.params.email;

    const result =
      await petsCollection
        .find({
          ownerEmail: email,
        })
        .sort({
          createdAt: -1,
        })
        .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send(error);
  }
});



//Cancel Request Route


app.delete("/pets/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // Delete all adoption requests of this pet
    await adoptionRequestsCollection.deleteMany({
      petId: id,
    });

    // Delete pet
    const result = await petsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);

  } catch (error) {
    res.status(500).send(error);
  }
});



//Update Pet

app.put("/pets/:id",async (req, res) => {
  try {
    const id = req.params.id;

    const updatedData = req.body;

    const result =
      await petsCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: updatedData,
        }
      );

    res.send(result);
  } catch (error) {
    res.status(500).send(error);
  }
});




//Single Pet

app.get("/pets/:id", async (req, res) => {
  try {
    console.log("Pet ID:", req.params.id);

    const pet = await petsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    console.log("Pet Found:", pet);

    if (!pet) {
      return res.status(404).send({
        message: "Pet not found",
      });
    }

    res.send(pet);
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});










// Get Requests By Pet Id


app.get("/requests/:petId", async (req, res) => {
  try {
    const petId = req.params.petId;

    const result =
      await adoptionRequestsCollection
        .find({ petId })
        .toArray();

    res.send(result);

  } catch (error) {
    res.status(500).send(error);
  }
});


  //Reject Request
  app.patch("/reject-request/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const result =
      await adoptionRequestsCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            status: "rejected",
          },
        }
      );

    res.send(result);
  } catch (error) {
    res.status(500).send(error);
  }
});





app.post("/adoption-requests", async (req, res) => {
  try {
    const adoptionData = req.body;

    const pet = await petsCollection.findOne({
      _id: new ObjectId(adoptionData.petId),
    });

    if (!pet) {
      return res.status(404).send({
        success: false,
        message: "Pet not found",
      });
    }

    if (pet.ownerEmail === adoptionData.userEmail) {
      return res.status(400).send({
        success: false,
        message: "Owner cannot adopt own pet",
      });
    }

    if (pet.adopted) {
      return res.status(400).send({
        success: false,
        message: "Pet already adopted",
      });
    }

    const existingRequest =
      await adoptionRequestsCollection.findOne({
        petId: adoptionData.petId,
        userEmail: adoptionData.userEmail,
      });

    if (existingRequest) {
      return res.status(400).send({
        success: false,
        message: "You already requested this pet",
      });
    }

    const result =
      await adoptionRequestsCollection.insertOne({
        ...adoptionData,
        status: "pending",
        createdAt: new Date(),
      });

    res.send({
      success: true,
      insertedId: result.insertedId,
    });

  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to create request",
    });
  }
});











app.patch("/approve-request/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const request =
      await adoptionRequestsCollection.findOne({
        _id: new ObjectId(id),
      });

    if (!request) {
      return res.status(404).send({
        message: "Request not found",
      });
    }

    // approve selected request

    await adoptionRequestsCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          status: "approved",
        },
      }
    );


    // reject other requests

    await adoptionRequestsCollection.updateMany(
      {
        petId: request.petId,
        _id: {
          $ne: new ObjectId(id),
        },
      },
      {
        $set: {
          status: "rejected",
        },
      }
    );

    // mark pet adopted

   await petsCollection.updateOne(
  {
    _id: new ObjectId(request.petId),
  },
  {
    $set: {
      adopted: true,
      status: "adopted",
    },
  }
);

    res.send({
      success: true,
      message: "Request Approved",
    });
  } catch (error) {
    res.status(500).send(error);
  }
});





//request cancel
app.delete("/requests/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const result =
      await adoptionRequestsCollection.deleteOne({
        _id: new ObjectId(id),
      });

    res.send(result);

  } catch (error) {
    res.status(500).send(error);
  }
});


  
//My Requests
app.get("/my-requests/:email",verifyToken,async (req, res) => {
  try {
    const email = req.params.email;

    const result =
      await adoptionRequestsCollection
        .find({
          userEmail: email,
        })
        .sort({
          createdAt: -1,
        })
        .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send(error);
  }
});




  
  app.get("/pet-requests/:petId", async (req, res) => {
  try {
    const { petId } = req.params;

    const requests =
      await adoptionRequestsCollection
        .find({ petId })
        .sort({ createdAt: -1 })
        .toArray();

    res.send(requests);

  } catch (error) {
    res.status(500).send(error);
  }
});





  } catch (error) {
    console.error("Server Error:", error);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("PetTopia Server Running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});