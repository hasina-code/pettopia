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

    //  Required fields check
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).send({
        success: false,
        message: "All fields are required",
      });
    }

    // Normalize values (IMPORTANT FIX)
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

    
    //  Password match check
  
    if (safePassword !== safeConfirm) {
      return res.status(400).send({
        success: false,
        message: "Passwords do not match",
      });
    }

 
    //  Password strength check
    if (safePassword.length < 6) {
      return res.status(400).send({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    //  Check existing user
   
    const existingUser = await usersCollection.findOne({
      email: safeEmail,
    });

    if (existingUser) {
      return res.status(400).send({
        success: false,
        message: "User already exists",
      });
    }

    //  Hash password
  
    const hashedPassword = await bcrypt.hash(safePassword, 10);

   
    // Save user
  
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

  
    // Filter by species
    // Using MongoDB $in
   

    if (species && species.trim() !== "") {
      const speciesArray = species
        .split(",")
        .map((item) => item.trim());

      query.species = {
        $in: speciesArray,
      };
    }

  
    // Sorting Options
  

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




//My Listings



//Cancel Request Route





//Update Pet


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