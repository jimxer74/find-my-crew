'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from './components/Header';
import { useAuth } from './contexts/AuthContext';

export default function Home() {
  const { user } = useAuth();
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 drop-shadow-lg">
              Connect Boat Owners with
              <span className="text-blue-300"> Crew Members</span>
            </h2>
            <p className="text-xl text-white/95 mb-8 max-w-2xl mx-auto drop-shadow-md">
            Whether you're a boat owner looking for crew or an adventurer seeking sailing opportunities, 
            we make it easy to find your perfect match.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <>
                <Link
                  href="/journeys"
                  className="bg-primary text-primary-foreground px-8 py-3 rounded-lg transition-opacity font-medium text-lg text-center hover:opacity-90"
                >
                  Browse Journeys
                </Link>
                {user && (
                  <Link
                    href="/owner/boats"
                    className="border-2 border-primary text-primary px-8 py-3 rounded-lg transition-colors font-medium text-lg text-center hover:bg-primary/10"
                  >
                    My Dashboard
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link
                  href="/auth/signup"
                  className="bg-primary text-primary-foreground px-8 py-3 rounded-lg transition-opacity font-medium text-lg text-center hover:opacity-90"
                >
                  Sign up
                </Link>
                <Link
                  href="/auth/login"
                  className="border-2 border-primary text-primary px-8 py-3 rounded-lg transition-colors font-medium text-lg text-center hover:bg-primary/10"
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
          {/* For Owners */}
          <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-xl p-8 border border-border/20">
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
          <div className="bg-card/80 backdrop-blur-sm rounded-xl shadow-xl p-8 border border-border/20">
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="text-3xl font-bold text-center text-white mb-12 drop-shadow-lg">How It Works</h3>
        <div className="grid md:grid-cols-3 gap-8">
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-2xl p-12 text-center bg-primary">
          <h3 className="text-3xl font-bold text-primary-foreground mb-4">
            Ready to Start Your Adventure?
          </h3>
          <p className="text-primary-foreground/90 mb-8 text-lg max-w-2xl mx-auto">
            Join our community of boat owners and crew members today
          </p>
          <Link
            href={user ? '/owner/boats' : '/auth/signup'}
            className="bg-card text-primary px-8 py-3 rounded-lg transition-opacity font-medium text-lg inline-block hover:opacity-90"
          >
            {user ? 'Go to Dashboard' : 'Sign up'}
          </Link>
        </div>
      </section>

        {/* Footer */}
        <footer className="border-t border-white/20 bg-white/90 backdrop-blur-md mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-white/80">
            <p className="mb-2">© 2024 Find My Crew. All rights reserved.</p>
            <p className="text-sm text-white/70">
              Connecting boat owners with crew members worldwide
            </p>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
