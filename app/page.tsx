'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from './components/Header';
import { useAuth } from './contexts/AuthContext';
import { LoginModal } from './components/LoginModal';
import { SignupModal } from './components/SignupModal';
import { Footer } from './components/Footer';

export default function Home() {
  const { user } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Background image with zoom effect */}
      <div 
        className="fixed inset-0 bg-cover bg-center homepage-bg-zoom -z-10"
        style={{
          backgroundImage: 'url(/homepage-2.jpg)',
        }}
      />
      {/* Overlay for better text readability */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] -z-10"></div>
      
      {/* Navigation */}
      <Header />
      
      {/* Content wrapper with relative positioning */}
      <div className="relative z-10">

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 md:py-32">
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-4 sm:mb-6 drop-shadow-lg px-2">
              Connect Boat Owners with
              <span className="text-blue-300"> Crew Members</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-white/95 mb-6 sm:mb-8 max-w-2xl mx-auto drop-shadow-md px-2">
            Whether you're a boat owner looking for crew or an adventurer seeking sailing opportunities, 
            we make it easy to find your perfect match.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-2">
            {user ? (
              <>
                <Link
                  href="/crew/dashboard"
                  className="bg-primary text-primary-foreground px-6 sm:px-8 py-3 min-h-[44px] flex items-center justify-center rounded-lg transition-opacity font-medium text-base sm:text-lg hover:opacity-90"
                >
                  Browse Journeys
                </Link>
                {user && (
                  <Link
                    href="/owner/boats"
                    className="border border-primary text-primary px-6 sm:px-8 py-3 min-h-[44px] flex items-center justify-center rounded-lg transition-colors font-medium text-base sm:text-lg hover:bg-primary/10"
                  >
                    My Dashboard
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link
                  href="/crew/dashboard"
                  className="bg-primary text-primary-foreground px-6 sm:px-8 py-3 min-h-[44px] flex items-center justify-center rounded-lg transition-opacity font-medium text-base sm:text-lg hover:opacity-90"
                >
                  Browse Journeys
                </Link>
                <button
                  onClick={() => setIsSignupModalOpen(true)}
                  className="border border-primary text-primary px-6 sm:px-8 py-3 min-h-[44px] flex items-center justify-center rounded-lg transition-colors font-medium text-base sm:text-lg hover:bg-primary/10"
                >
                  Sign up
                </button>
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="border border-primary text-primary px-6 sm:px-8 py-3 min-h-[44px] flex items-center justify-center rounded-lg transition-colors font-medium text-base sm:text-lg hover:bg-primary/10"
                >
                  Log in
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <div className="grid md:grid-cols-2 gap-6 sm:gap-12 lg:gap-16">
          {/* For Owners */}
          <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-xl p-6 sm:p-8 border border-border/20">
            <div className="w-16 h-16 mb-4 relative">
              <Image
                src="/boat2.png"
                alt="Boat Owner"
                fill
                className="object-contain"
              />
            </div>
            <h3 className="text-2xl font-bold text-card-foreground mb-4">For Boat Owners & Skippers</h3>
            <p className="text-muted-foreground mb-6">
              Need crew for your next voyage? Easily post your boat details and journey plans, 
              break them into legs, and find qualified crew members ready to join your adventure.
            </p>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start">
                <span className="mr-2 text-primary">✓</span>
                <span>Register and manage your boats</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-primary">✓</span>
                <span>Plan journeys and divide into legs</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-primary">✓</span>
                <span>Review and approve crew applications</span>
              </li>
            </ul>
          </div>

          {/* For Crew */}
          <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-xl p-6 sm:p-8 border border-border/20">
            <div className="w-16 h-16 mb-4 relative">
              <Image
                src="/seaman2.png"
                alt="Crew Member"
                fill
                className="object-contain"
              />
            </div>
            <h3 className="text-2xl font-bold text-card-foreground mb-4">For Crew Members</h3>
            <p className="text-muted-foreground mb-6">
              Looking for sailing opportunities? Browse available journeys, view detailed leg information, 
              and apply to join voyages that match your skills and interests.
            </p>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start">
                <span className="mr-2 text-primary">✓</span>
                <span>Browse available journeys and legs</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-primary">✓</span>
                <span>Filter by location, dates, and skills</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-primary">✓</span>
                <span>Apply to join your dream voyage</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <h3 className="text-2xl sm:text-3xl font-bold text-center text-white mb-8 sm:mb-12 drop-shadow-lg px-2">How It Works</h3>
        <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
              <span className="text-2xl font-bold text-white">1</span>
            </div>
            <h4 className="text-xl font-semibold text-white mb-2 drop-shadow-md">Sign Up</h4>
            <p className="text-white/90 drop-shadow-sm">
              Create your account as an owner/skipper or crew member
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
              <span className="text-2xl font-bold text-white">2</span>
            </div>
            <h4 className="text-xl font-semibold text-white mb-2 drop-shadow-md">Connect</h4>
            <p className="text-white/90 drop-shadow-sm">
              Owners post journeys, crew members browse and apply
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
              <span className="text-2xl font-bold text-white">3</span>
            </div>
            <h4 className="text-xl font-semibold text-white mb-2 drop-shadow-md">Sail Together</h4>
            <p className="text-white/90 drop-shadow-sm">
              Owners approve applications and you're ready to set sail!
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <div className="rounded-2xl p-6 sm:p-12 text-center bg-primary">
          <h3 className="text-2xl sm:text-3xl font-bold text-primary-foreground mb-3 sm:mb-4 px-2">
            Ready to Start Your Adventure?
          </h3>
          <p className="text-primary-foreground/90 mb-6 sm:mb-8 text-base sm:text-lg max-w-2xl mx-auto px-2">
            Join our community of boat owners and crew members today
          </p>
          {user ? (
            <Link
              href="/owner/boats"
              className="bg-card text-primary px-6 sm:px-8 py-3 min-h-[44px] inline-flex items-center justify-center rounded-lg transition-opacity font-medium text-base sm:text-lg hover:opacity-90"
            >
              Go to Dashboard
            </Link>
          ) : (
            <button
              onClick={() => setIsSignupModalOpen(true)}
              className="bg-card text-primary px-6 sm:px-8 py-3 min-h-[44px] inline-flex items-center justify-center rounded-lg transition-opacity font-medium text-base sm:text-lg hover:opacity-90"
            >
              Sign up
            </button>
          )}
        </div>
      </section>

        {/* Footer */}
        <Footer />
      </div>
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSwitchToSignup={() => {
          setIsLoginModalOpen(false);
          setIsSignupModalOpen(true);
        }}
      />
      <SignupModal
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
        onSwitchToLogin={() => {
          setIsSignupModalOpen(false);
          setIsLoginModalOpen(true);
        }}
      />
    </div>
  );
}
