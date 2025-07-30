const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();
const multer = require('multer');

const storage = multer.diskStorage({
    destination: (req,file, cb) =>{
        cb(null, 'public/images');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({storage: storage});

// Database connection
const db = mysql.createConnection({
    host: 'c237-all.mysql.database.azure.com',
    user: 'c237admin',
    password: 'c2372025!',
    database: 'C237_usersdb_011_t2'
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));

//******** Code for Session Middleware below ********//
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: {maxAge: 1000 * 60 * 60 * 24 * 7}
}));

app.use(flash());

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Setting up EJS
app.set('view engine', 'ejs');

// Login (Post + Login)
app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM user WHERE email = ? AND password = ?';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            // Successful login
            req.session.user = results[0]; 
            req.flash('success', 'Login successful!');
            if(req.session.user.role == 'user')
                res.redirect('/dashboard');
            else
                res.redirect('/dashboard');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Register (Post + Get)
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

app.post('/register', validateRegistration, (req, res) => {

    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO user (username, email, password, address, contact, role) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

// Dashboard
app.get('/dashboard', checkAuthenticated, (req, res) =>{
    res.render('dashboard', {user: req.session.user});
});

// Routes
// IG Members Homepage
app.get('/MembersHomepage', checkAuthenticated, (req, res) => {
    const sql = 'SELECT * FROM members';
    // Fetch data from mySQL
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving members');
        }
    // Render HTML page with data
    res.render('MembersHomepage', {members: results, user: req.session.user});
    });
});

// Add Members (Post + Get)
app.get('/addMembers',checkAuthenticated,checkAdmin, (req, res) => {
    res.render('addMembers');
});

app.post('/addMembers',checkAuthenticated,checkAdmin, (req, res) => {
    // Extract product data from the request body
    const { id, student_id, ig_id, role, joined_date } = req.body;
    const sql = 'INSERT INTO members (id, student_id, ig_id, role, joined_date) VALUES (?, ?, ?, ?, ?)';

    // Insert the new product into the database
    db.query(sql, [id, student_id, ig_id, role, joined_date], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error adding members:", error);
            res.status(500).send('Error adding members');
        } else {
            // Send a success response
            res.redirect('/MembersHomepage');
        }
    });
});

// Delete Member
app.get('/deleteMembers/:id',checkAuthenticated,checkAdmin, (req, res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM members WHERE id = ?';
    db.query(sql, [id], (error, results) => {
        if (error) {    
            // Handle any error that occurs during the database operation
            console.error("Error deleting member:", error);
            res.status(500).send('Error deleting member');
        } else {
            // Send a success response
            res.redirect('/MembersHomepage');
        }
    });
});

// Edit Student (Post + Get)
app.get('/editMembers/:id',checkAuthenticated,checkAdmin, (req, res) => {
    const id = req.params.id;
    const sql = 'SELECT * FROM members WHERE id = ?';
    // Fetch data from MySQL based on the Product ID
    db.query(sql, [id], (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving member by ID');
        }
        // Check if any product with the given ID was found
        if (results.length > 0) {
            // Render HTML page with the product data
            res.render('editMembers', { members: results[0] });
        } else {
            // If no product with the given ID was found, render a 404 page or handle it accordingly
            res.status(404).send('Member not found');
        }
    });
});

app.post('/editMembers/:id',checkAuthenticated,checkAdmin, (req, res) => {
    const id = req.params.id;
    // Extra product data from the request body
    const { student_id, ig_id, role, joined_date } = req.body;
    const sql = 'UPDATE members SET student_id = ?, ig_id = ?, role = ?, joined_date = ? WHERE id = ?';

    // Insert the new product into the database
    db.query( sql, [ student_id, ig_id, role, joined_date, id], (error, results) => {
        if (error) {
        // Handle any error that occurs during the database operation
        console.error("Error editing member:", error);
        res.status(500).send('Error editing member');
    } else {
        // Send a success response
        res.redirect('/MembersHomepage');
        }
    });
});

// Search Page (Post + Get)
app.get('/Membersearch',checkAuthenticated, (req, res) => {
    res.render('Membersearch', { results: undefined });
});

app.post('/Membersearch', (req, res) => {
    const keyword = req.body.keyword;

    const sql = `
        SELECT * FROM members 
        WHERE student_id LIKE ? 
        OR ig_id LIKE ? 
        OR role LIKE ?
    `;

    const likeKeyword = `%${keyword}%`;

    db.query(sql, [likeKeyword, likeKeyword, likeKeyword], (err, results) => {
        if (err) {
            console.error('Search error:', err);
            return res.status(500).send('Error performing search');
        }

        res.render('search', { results });
    });
});


// Josh's School Module
app.get('/schoolHomepage',checkAuthenticated, (req,res) =>{
    const sql = 'SELECT  *FROM school';
    db.query(sql, (error,results) =>{
        if (error){
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retreving products');
        }
        res.render('schoolHomepage', {school: results, user: req.session.user});
    });
});

app.get('/Schoolsearch',checkAuthenticated, (req, res) => {
    const query = req.query.query;
    const sql = "SELECT * FROM school WHERE name LIKE ? OR address LIKE ?";
    const searchValue = '%' + query + '%';
    db.query(sql, [searchValue, searchValue], (error, results) => {
        if (error) {
            console.error('Error searching schools:', error.message);
            return res.status(500).send('Error searching schools');
        }
        res.render('schoolHomepage', { school: results });
    });
});
``
app.get('/school/:id',checkAuthenticated,(req,res) => {
    const id = req.params.id;
    const sql = 'SELECT * FROM school WHERE id = ?';
    db.query(sql , [id], (error,results) =>{
        if (error){
            console.error('Database query error:'. error.messsage);
            return res.status(500).send('Error Retrieving product by ID');
        }
        if (results.length > 0){
            res.render('school', {school: results[0]});
        }
        else {
            res.status(404).send('school not found')
        }
    });
});

app.get('/addschool',checkAuthenticated,checkAdmin,(req,res) => {
    res.render('addschool');
});

app.post('/addschool',checkAuthenticated,checkAdmin,upload.single('image'),(req,res) => {
    const{name,address,contact} = req.body;
    let image;
    if (req.file) {
        image = req.file.filename;
    } else {
        image = null;
    }
    const sql = 'INSERT INTO school (name,address,contact,school_logo) VALUES(?,?,?,?)';
    db.query (sql,[name,address,contact,image],(error,results) => {
        if (error){
            console.error("Error adding school:", error);
            res.status(500).send('Error adding school');
        }
        else{
            res.redirect('/');
        }
    });
});
app.get('/editschool/:id',checkAuthenticated,checkAdmin,(req,res) => {
    const id = req.params.id;
    const sql = 'SELECT * FROM school WHERE id = ?';
    db.query(sql , [id], (error,results) =>{
        if (error){
            console.error('Database query error:', error.messsage);
            return res.status(500).send('Error Retrieving school by ID');
        }
        if (results.length > 0){
            res.render('editschool', {school: results[0]});
        }
        else {
            res.status(404).send('school not found')
        }
    });
});

app.post('/editschool/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    const id = req.params.id;
    const {name, address, contact} = req.body;
    let image = req.body.currentImage;
    if (req.file){
        image = req.file.filename;
    }
    const sql = 'UPDATE school SET name = ?, address = ?, contact = ?, school_logo = ? WHERE id = ?';
    db.query(sql , [name, address, contact, image, id], (error,results) =>{
        if (error){
            console.error('Error updating school', error);
            res.status(500).send('Error updating school');
        }
        else {
            res.redirect('/');
        }
    });
});

// Delete School
app.get('/deleteschool/:id',checkAuthenticated,checkAdmin,(req,res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM school WHERE id = ?';
    db.query(sql , [id], (error,results) =>{
        if (error){
            console.error('Error deleting school', error);
            res.status(500).send('Error deleting school');
        }
        else {
            res.redirect('/');
        }
    });
});

// Peter's Gallery
app.get('/GalleriesHomepage',checkAuthenticated, (req, res) => {
  const sql = 'SELECT * FROM galleries ORDER BY upload_date DESC';
  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    res.render('GalleriesHomepage', {
      galleries: results,
      session: req.session,
      user: req.session.user  // <-- Pass session here
    });
  });
});

// Add Gallery
app.get('/addGallery', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = 'SELECT id, category FROM interest_groups';
  
    db.query(sql, (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Database error');
      }
  
      res.render('addGallery', {
        interestGroups: results,
        user: req.session.user
      });
    });
  });  

app.post('/addGallery', checkAuthenticated, checkAdmin, (req, res) => {
  const { ig_id, media_url, caption, upload_date } = req.body;

  // Validate inputs (optional but recommended)
  if (!ig_id || !media_url || !caption || !upload_date) {
    return res.status(400).send('All fields are required.');
  }

  const sql = 'INSERT INTO galleries (ig_id, media_url, caption, upload_date) VALUES (?, ?, ?, ?)';
  db.query(sql, [ig_id, media_url, caption, upload_date], (err) => {
    if (err) {
      console.error('Insert error:', err);
      return res.status(500).send('Failed to add gallery item');
    }
    res.redirect('/');
  });
});

// Edit Gallery
// If your URL is /editGallery/:id, define:
// GET: Edit Gallery Form
app.get('/editGallery/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const galleryId = req.params.id;
  
    const getGalleryQuery = 'SELECT * FROM galleries WHERE id = ?';
    const getInterestGroupsQuery = 'SELECT id, category FROM interest_groups';
  
    db.query(getGalleryQuery, [galleryId], (err, galleryResults) => {
      if (err) {
        console.error('DB Error getting gallery:', err);
        return res.status(500).send('Database error fetching gallery.');
      }
  
      if (galleryResults.length === 0) {
        return res.status(404).send('Gallery not found.');
      }
  
      db.query(getInterestGroupsQuery, (err2, igResults) => {
        if (err2) {
          console.error('DB Error loading interest groups:', err2);
          return res.status(500).send('Error loading interest groups.');
        }
  
        res.render('editGallery', {
          gallery: galleryResults[0],
          interestGroups: igResults,
          user: req.session.user // Needed for navbar visibility
        });
      });
    });
  });
  
  // POST: Update Gallery
  app.post('/editGallery/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const galleryId = req.params.id;
    const { ig_id, media_url, caption, upload_date } = req.body;
  
    const updateQuery = `
      UPDATE galleries
      SET ig_id = ?, media_url = ?, caption = ?, upload_date = ?
      WHERE id = ?
    `;
  
    db.query(updateQuery, [ig_id, media_url, caption, upload_date, galleryId], (err, result) => {
      if (err) {
        console.error('Error updating gallery:', err);
        return res.status(500).send('Database update error');
      }
  
      res.redirect('/GalleriesHomepage'); // Make sure this matches your homepage route
    });
  });  

// Delete
app.get('/deleteGallery/:id', checkAuthenticated, checkAdmin, (req, res) => {
    db.query('DELETE FROM galleries WHERE id = ?', [req.params.id], err => {
        if (err) return res.status(500).send('Delete failed');
        res.redirect('/');
    });
});

// Search
// GET search form
app.get('/Gallariessearch', checkAuthenticated, (req, res) => {
    res.render('Gallariessearch', { results: undefined, session: req.session, keyword: '' });
  });
  
  // POST search results
app.post('/Gallariessearch',checkAuthenticated, (req, res) => {
    const keyword = `%${req.body.keyword}%`;
    const sql = `SELECT * FROM galleries WHERE caption LIKE ? OR media_url LIKE ? OR ig_id LIKE ?`;
    db.query(sql, [keyword, keyword, keyword], (err, results) => {
      if (err) return res.status(500).send('Search failed');
      res.render('Gallariessearch', {
        results,
        session: req.session,
        keyword: req.body.keyword
      });
    });
});

// Starting the server
const PORT = process.env.PORT || 3000;
app.listen(PORT,() => {
    console.log(`Server running at http://localhost:${PORT}/login`);
});