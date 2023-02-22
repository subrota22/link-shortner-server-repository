const dotenv = require("dotenv");
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, Double, ObjectId } = require('mongodb');
const shortid = require("shortid");
const jwt = require('jsonwebtoken');
// configure dotenv
dotenv.config();
const app = express();

// cors for cross-origin requests to the frontend application
app.use(cors());
// parse requests of content-type - application/json
app.use(express.json());

//verify jwt token
const verifyJWT = (req, res, next) => {
  const getToken = req.headers.authorization;
  if (!getToken) {
    return res.status(401).send({ message: "unauthorize access" });
  }
  const token = getToken.split(" ")[1];
  jwt.verify(token, process.env.SECRET_TOKEN, (error, decoded) => {
    if (error) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  })
}


// Database connection
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
  try {
    //collections

    const shortLinksCollection = client.db("linkShortner").collection("shortLinks");
    const userCollection = client.db("linkShortner").collection("users");

    //create new user
    app.post("/users", async (req, res) => {
      const userInformation = req.body;
      const query = { email: req.body.email };
      const alreadyExist = await userCollection.findOne(query);
      if (alreadyExist) {
        res.status(401).send({ existed: "Already have an account of yours in our collection 👋 👋 " });
        return;
      }
      const result = await userCollection.insertOne(userInformation);
      res.status(201).send(result);
    })

    // URL shortener endpoint
    app.post("/shortLinks", async (req, res) => {
      const origUrl = req.body.url;
      const base = `https://mitly.vercel.app`;

      const urlId = shortid.generate();
    
      try {

        const shortUrl = `${base}/${urlId}`;
        const insertData = {
          name: req.body?.name,
          email: req.body?.email,
          origUrl: origUrl,
          shortUrl: shortUrl,
          urlId: urlId,
          clicks: parseInt(0),
          date: new Date(),
          time: new Date().toLocaleTimeString(),
          month: new Date().toLocaleDateString(),
        }

        const result = await shortLinksCollection.insertOne(insertData);
        // const expireTrue = await shortLinksCollection.createIndex({date:1} , {expireAfterSeconds:2592000}) ;
        //  if(expireTrue) { 
        //   console.log("Expired true");
        //  }
        res.send({ shortUrl: shortUrl, result: result });

      } catch (err) {
        console.log(err);
        res.status(500).json('Server Error');
      }
    });

    // get shortLinks saved URLs 
    app.get("/shortLinks", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const result = await shortLinksCollection.find({ email: email }).sort({ _id: -1 }).toArray();
        res.send(result);
      } else {
        res.status(403).send({ message: "unauthorize access" });
      }

    })


    // redirect endpoint
    app.get("/:urlId", async (req, res) => {

      try {
        let url = await shortLinksCollection.findOne({ urlId: req.params.urlId });

        if (url) {
          await shortLinksCollection.updateOne({ _id: new ObjectId(url._id) }, { $inc: { clicks: 1 } });
          return res.redirect(url.origUrl);
      }else{
        return res.send(" Url not found !!") ;
      //  return res.write('<html> <h2> Url not found !! </h2> </html>')
      }
    }
      catch (err) {
        res.status(500).json({"ServerError": err });
      }
    });

    //delete single short url 
    app.delete("/shortLinks/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await shortLinksCollection.deleteOne(filter);
      res.status(201).send(result);
    })
  } finally {
    // Ensures that the client will close when you finish/error
  }
}

run().catch(error => console.error(error));

//generate new token token 
app.post("/jwt", async (req, res) => {
  const email = req.body;
  const token = jwt.sign(email, process.env.SECRET_TOKEN, { expiresIn: "2d" });
  res.status(201).send({ token: token });
})

app.get("/", (req, res) => {
  res.send("Welcome to the link shortner !! ")
})

// Port Listenning on 3333
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Server is running at PORT ${PORT}`);
});
if (client) {
  console.log("MongoDB server running");
}
