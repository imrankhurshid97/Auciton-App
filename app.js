//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const { Router } = require('express');
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt")


const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/auctionDB", {useNewUrlParser: true});
mongoose.set("useCreateIndex", true);


const itemSchema = new mongoose.Schema({
  email : String,
  name : String,
  startPrice : Number,
  productName : String,
  dop : Date,
  active : Boolean,
  fullName : String,
  toUsers : Boolean
});

const userSchema = new mongoose.Schema ({
  firstName : String,
  lastName : String,
  phone : String,
  username: String,
  password: String,
  type :String,
  googleId: String,
  part : [String]
});


const sellerSchema = new mongoose.Schema({
  username : String,
  password : String,
  type : String
})


const adminSchema = new mongoose.Schema({
  username : String,
  password : String,
  type : String
});




userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
sellerSchema.plugin(passportLocalMongoose);
adminSchema.plugin(passportLocalMongoose);
// sellerSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);
const Seller = new mongoose.model("Seller",sellerSchema);
const Admin = new mongoose.model("Admin",adminSchema);
const Item = new mongoose.model("Item",itemSchema);
// passport.use(User.createStrategy());
// passport.use("local-user",User.createStrategy()); 

passport.use('admin', new LocalStrategy(function(username, password, done){
  // console.log(username);
  var query = {username: username};
  Admin.findOne(query, function(err, user){
      // console.log(user);
      if(err) throw err;
      if(!user){
          return done(null, false);
      }
      bcrypt.compare(password,user.password, function(err, isMatch){
        var b = password === user.password;
          // console.log(b);
          if(err) throw err;
          if(b)
              return done(null, user);
          else
          {
            console.log("not good");
            return done(null,false);
          }
              
      })
  })
}))

passport.use('local-user', new LocalStrategy(function(username, password, done){
  // console.log(username);
  var query = {username: username};
  User.findOne(query, function(err, user){
      if(err) throw err;
      if(!user){
          return done(null, false);
      }
      bcrypt.compare(password,user.password, function(err, isMatch){
          if(err) throw err;
          if(isMatch)
              return done(null, user);
          else
              return done(null,false);
      })
  })
}))

passport.use('local-seller', new LocalStrategy(function(username, password, done){
  // console.log(username);
  var query = {username: username};
  Seller.findOne(query,(err,seller) =>{
    if(err)throw err;
    if(!seller){
      console.log("Not ok");
      return done(null,false);
    }
    bcrypt.compare(password,seller.password, function(err, isMatch){
      if(err) throw err;
      if(isMatch)
          return done(null, seller);
      else
          return done(null,false);
    })


  });
}))
  






// passport.serializeUser(function(user, done) {
//   console.log(user);
//   done(null, user.id);
// });

passport.serializeUser(function (entity, done) {
  done(null, { id: entity.id, type: entity.type });
});



passport.deserializeUser(function (obj, done) {
  switch (obj.type) {
      case 'user':
          User.findById(obj.id)
              .then(user => {
                  if (user) {
                      done(null, user);
                  }
                  else {
                      done(new Error('user id not found:' + obj.id, null));
                  }
              });
          break;
      case 'seller':
          Seller.findById(obj.id)
              .then(device => {
                  if (device) {
                      done(null, device);
                  } else {
                      done(new Error('device id not found:' + obj.id, null));
                  }
              });
          break;
      case 'admin':
            Admin.findById(obj.id)
                .then(device => {
                    if (device) {
                        done(null, device);
                    } else {
                        done(new Error('device id not found:' + obj.id, null));
                    }
                });
            break;
      default:
          done(null, null);
          break;
  }
});

//Google strategy
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/home",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    profileFields: ["id", "displayName", "photos", "email"]
  },
  function(accessToken, refreshToken, profile, done) {
    // console.log(profile);

    User.findOrCreate({ username: profile.id },{name: profile.displayName }, function (err, user) {
      return done(err, user);
    });
  }
));

app.get("/", function(req, res){
  res.render("index");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/home",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to home.
    res.redirect("/home");
  });


//Admin route
app.get("/admin",(req,res)=>{
  
  
  if(req.isAuthenticated())
  {

    Item.find({active : true},(err,results) =>{
      res.render("admin",{results : results});
      // res.send(results);
    });


    
    
  }
  else
    res.redirect("/login");
});


app.post("/admin/changeStatus",(req,res)=>{
  // res.send(req.body.id);

  Item.findOneAndUpdate({_id:req.body.id},{toUsers:true},(err,result) => {
    if(err)
    console.error(err);
    else
      res.redirect("/admin");
  });


});

// Normal user routes


app.get("/login", function(req, res){
  res.render("login");
});

app.get("/register", function(req, res){
  res.render("register");
});


app.get("/home",(req,res) => {
  console.log("I am in");
  if(req.isAuthenticated())
  {
    var display;
    // console.log(req);
    // res.send(req);
    if(req.user.username)
    {
      display = req.user.username;
      // console.log(req);
    }
      
    Item.find({toUsers : true},function(err,results){
      res.render("home",{username:display,results:results});
    });
    
  }
    else
        res.redirect("/login");
  
})
app.post("/register", function(req, res){

  var newUser = new User({
    username : req.body.username,
    password : req.body.password,
    type : "user"
  });


  
    bcrypt.genSalt(10, function(err,  salt){
        bcrypt.hash(newUser.password, salt, function(err, hash){
            if(!err){
                newUser.password = hash;
            }
            newUser.save(function(err){
                if(!err){
                    console.log("success in reg");
                    res.redirect("/login")
                }
            })
        })
    })
});

app.post("/login", function(req, res){

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

    
  req.login(user, function(err){
    if (err) {
      console.log(err);
    } 
    if(req.body.username === "admin")
    {
      passport.authenticate("admin")(req, res, function(){
        res.redirect("/admin");
      });
    }
    else {
      passport.authenticate("local-user")(req, res, function(){
        res.redirect("/home");
      });
    }
  });

});



app.post("/home/participate",(req,res) =>{

  let id = req.user._id;
  User.findOne({_id : id},function(err,result){

    let newid = req.body.id;
    result.part.push(req.body.id);
    result.save();
  });
  res.redirect("/home");
});

app.get("/home/joined",(req,res) =>{
  
  // res.send(req.user);
  User.find({_id:req.user._id},(err,result)=>{
    let arr = result[0].part;
    console.log(arr);
    // res.send(result)
    Item.find({"_id": {$in : arr}},(err,items) =>{
      res.render("joined",{results:items})
    });
  })

});


app.get("/inter",(req,res) =>{
  res.send(req.isAuthenticated());
});


// Seller routes
app.get("/seller-login",(req,res) => {
  res.render("seller-login");
})

app.post("/seller-login",(req,res)=>{

  const seller = new Seller({
    username : req.body.username,
    password : req.body.password
  });

  // res.redirect("/seller-home");
  req.login(seller, function(err){
    if (err) {
      // res.redirect("/seller-login");
      console.log(err);
    } else {
      passport.authenticate("local-seller")(req, res, function(){
        res.redirect("/seller-home");
      });
    }
  });
});


app.get("/seller-register",(req,res) =>{
  res.render("seller-register");
});

app.post("/seller-register",(req,res) =>{


  var newUser = new Seller({
    username : req.body.username,
    password : req.body.password,
    type : "seller"
  });
  console.log("Here");
   
    bcrypt.genSalt(10, function(err,  salt){
        bcrypt.hash(newUser.password, salt, function(err, hash){
            if(!err){
                newUser.password = hash;
            }
            newUser.save(function(err){
                if(!err){
                    console.log("success in reg");
                    res.redirect("/seller-login")
                    // res.send("Success registered!");
                }
            })
        })
    })
});

app.get("/seller-home",(req,res) =>{

  // console.log("Seller's in");
  // console.log(req);
  if(req.isAuthenticated())
  {
    res.render("seller-home",{username:req.user.username});

  }
    
  else
    res.redirect("/seller-login");
});


//routes related with items

app.post("/item-register",(req,res) =>{

  var newItem = new Item({
    fullName : req.body.name,
    email : req.body.email,
    productName : req.body.productName,
    dop : req.body.dop,
    startPrice : req.body.price,
    active : true,
    toUsers : false
  });

  newItem.save((err) => {
    if(err)console.error(err);
    else res.redirect("seller-home");
  })


});




// Logout
app.get("/logout", function(req, res){
  // console.log(req);
  req.logout();
  res.redirect("/");
});



app.listen(3000, function() {
  console.log("Server started on port 3000.");
});
