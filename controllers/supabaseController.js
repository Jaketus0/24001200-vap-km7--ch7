require('dotenv').config();
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://wzjssbfilwykninwwjre.supabase.co'
const supabaseKey = process.env.SUPABASE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS,
    },
});

class SupabaseController {
    static async createData(req, res) {
        try {
            const { name, email, phoneNum, password } = req.body;
            
            function isValidEmail(email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(email);
            }
            // input hanya berisi digit angka (0-9)
            if (!phoneNum || !/^\d+$/.test(phoneNum)) {
                return res.status(400).json({ error: 'Phone Number harus berupa angka dan tidak boleh kosong.' });
            }            
            if (!name || typeof name !== 'string') {
                return res.status(400).json({ error: 'Name harus berupa string dan tidak boleh kosong.' });
            }
            if (!name || !email || !password) {
                return res.status(400).send('Semua field harus diisi.');
            }
            if (!isValidEmail(email)) {
                return res.status(400).send('Email tidak valid. Harus mengandung "@" dan format yang benar.');
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            const { data, error } = await supabase
            .from('users')
            .insert([{ name, email, phoneNum, password: hashedPassword }]); 
            if (error) {
                console.error("Supabase error:", error);
                return res.status(500).json({ error: 'Gagal menyimpan data pengguna ke Supabase.' });
            }
            const token = jwt.sign({ email, name }, process.env.JWT_SECRET, {
                expiresIn: '1h',
            });
            const mailOptions = {
                from: process.env.EMAIL,
                to: email,
                subject: "Konfirmasi Pendaftaran",
                text: `Halo ${name}, silahkan konfirmasi pendaftaran anda dengan klik link di bawah ini.`,
                html: `<p>Halo ${name},</p><p>Silahkan klik link berikut untuk mengaktifkan akun anda:</p>
                        <a href="http://localhost:3000/activate/${token}">Konfirmasi Akun</a>
                        <p>Link berlaku untuk 1 jam</p>`,
            };
            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    console.error("Gagal mengirim email:", err);
                    return res.status(500).json({ message: "Gagal mengirim email konfirmasi." });
                }
                console.log("Email verifikasi berhasil dikirim:", info.response);
                res.render('success', { message: 'Silahkan cek email Anda untuk verifikasi!' });
            });
        } catch (err) {
            console.error('Server Error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    static renderRegisterPage(req, res) {
        res.render('register'); 
    }
    static async activateAccount(req, res) {
        try {
            const { token } = req.params;
    
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const { email } = decoded;
    
            const { data, error } = await supabase
                .from('users')
                .update({ is_active: true, activation_token_used: true })
                .eq('email', email);
    
            if (error) {
                return res.status(500).send('Gagal mengaktifkan akun.');
            }
    
            res.render('success', { message: 'Akun Anda berhasil diaktifkan!'});
        } catch (err) {
            console.error("Error:", err);
            res.status(400).render('error', { message: 'Link aktivasi tidak valid atau sudah kedaluwarsa.' });
        }
    }
    static async login(req, res) {
        try {
            const { phoneNum,  password } = req.body;
            if (!phoneNum || !/^\d+$/.test(phoneNum)) {
                return res.status(400).json({ error: 'Phone Number harus berupa angka dan tidak boleh kosong.' });
            }   
            if (!password) {
                return res.status(400).json({ error: 'Password harus diisi.' });
            }
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('phoneNum', phoneNum);
            if (error) {
                console.error("Supabase error:", error);
                return res.status(500).json({ error: 'Gagal mengambil data pengguna dari Supabase.' });
            }
            if (data.length === 0) {
                return res.status(400).json({ error: 'Email tidak terdaftar.' });
            }
            const user = data[0];
            if (!user.is_active) {
                return res.status(400).json({ error: 'Akun belum diaktifkan.' });
            }
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (!passwordMatch) {
                return res.status(400).json({ error: 'Password salah.' });
            }
            // res.render('profile', { name: user.name });
            // res.redirect('/profile');
            req.session.user = { name: user.name };
            const socketId = req.session.socketId; // Pastikan session menyimpan `socketId` user
            if (socketId) {
                io.to(socketId).emit('notification', `Welcome back, ${user.name}!`);
            }
            res.redirect('/profile');
        } catch (err) {
            console.error("Server error:", err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    static renderLoginPage(req, res) {
        res.render('login'); 
    }
    static async forgetPassword(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ error: 'Email harus diisi.' });
            }
            const { data, error } = await supabase
                .from('users')
                .select('email')
                .eq('email', email);
            if (error) {
                console.error("Supabase error:", error);
                return res.status(500).json({ error: 'Gagal mengambil data pengguna dari Supabase.' });
            }
            if (data.length === 0) {
                return res.status(400).json({ error: 'Email tidak terdaftar.' });
            }
            const token = jwt.sign({ email }, process.env.JWT_SECRET, {
                expiresIn: '1h',
            });
            const mailOptions = {
                from: process.env.EMAIL,
                to: email,
                subject: "Reset Password",
                text: `Silahkan klik link di bawah ini untuk mereset password Anda.`,
                html: `<p>Silahkan klik link berikut untuk mereset password Anda:</p>
                        <a href="http://localhost:3000/reset-password/${token}">Reset Password</a>
                        <p>Link berlaku untuk 1 jam</p>`,
            };
            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    console.error("Gagal mengirim email:", err);
                    return res.status(500).json({ message: "Gagal mengirim email reset password." });
                }
                res.redirect("/konfirmasi-email");
                console.log("Email reset password berhasil dikirim:", info.response);
            });
        } catch (err) {
            console.error('Server Error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async renderForgetPasswordPage(req, res) {
        res.render('forget-password');
    }
    static async resetPassword(req, res) {
        try {
            const { token } = req.params;
            const { password } = req.body;
            if (!password) {
                return res.status(400).json({ error: 'Password harus diisi.' });
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const { email } = decoded;
            const hashedPassword = await bcrypt.hash(password, 10);
            const { data, error } = await supabase
                .from('users')
                .update({ password: hashedPassword })
                .eq('email', email);
            if (error) {
                console.error("Supabase error:", error);
                return res.status(500).json({ error: 'Gagal mereset password.' });
            }
            const socketId = req.session.socketId;
            if (socketId) {
                io.to(socketId).emit('notification', 'Your password has been successfully updated.');
            }
            res.render('success', { message: 'Password berhasil direset!' });
        } catch (err) {
            console.error("Error:", err);
            res.status(400).render('error', { message: 'Link reset password tidak valid atau sudah kedaluwarsa.' });
        }
    }
    static async renderResetPasswordPage(req, res) {
        const { token } = req.params;
        res.render('reset-password', { token });
    }
    
}

module.exports = SupabaseController;