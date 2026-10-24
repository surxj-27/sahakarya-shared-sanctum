
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const signup = async (req, res) => {
  try {
   const { name, email, password } = req.body;

// 1. Check required fields
if (!name || !email || !password) {
  return res.status(400).json({
    message: "Name, email and password are required",
  });
}

// 2. Check password length
if (password.length < 6) {
  return res.status(400).json({
    message: "Password must be at least 6 characters",
  });
}

// 3. Normalize email
const normalizedEmail = email.trim().toLowerCase();

// 4. Check whether user already exists
const existingUser = await User.findOne({
  email: normalizedEmail,
});

if (existingUser) {
  return res.status(409).json({
    message: "User already exists",
  });
}

// 5. Hash password
const hashedPassword = await bcrypt.hash(password, 10);

// 6. Save user in MongoDB
const user = await User.create({
  name: name.trim(),
  email: normalizedEmail,
  password: hashedPassword,
});

// 7. Send safe response
return res.status(201).json({
  message: "Signup successful",
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
  },
});
  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate input
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // 2. Find user
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // 3. Compare password with hashed password
    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

  
const token = jwt.sign(
  { userId: user._id },
  process.env.JWT_SECRET,
  { expiresIn: "1d" }
);


    
return res.status(200).json({
  message: "Login successful",
  token:token,
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
  },
});

  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Profile error:", error.message);

    return res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = { signup ,login,getProfile};
