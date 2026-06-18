import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Products from './components/Products';
import Consulting from './components/Consulting';
import Services from './components/Services';
import Clients from './components/Clients';
import Contact from './components/Contact';
import Footer from './components/Footer';
import LoginModal from './components/LoginModal';
import './App.css';

const App = () => {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      <Navbar onLoginClick={() => setLoginOpen(true)} />
      <main>
        <Hero />
        <Products />
        <Consulting />
        <Services />
        <Clients />
        <Contact />
      </main>
      <Footer />
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
};

export default App;
