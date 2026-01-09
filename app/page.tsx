'use client';

import React from 'react';
import Link from 'next/link';
import { NavigationMenu } from './components/NavigationMenu';
import { LogoWithText } from './components/LogoWithText';
import { useAuth } from './contexts/AuthContext';

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background image with zoom effect */}
      <div 
        className="absolute inset-0 bg-cover bg-center homepage-bg-zoom"
        style={{
          backgroundImage: 'url(/homepage-2.jpg)',
        }}
      />
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"></div>
      
      {/* Content wrapper with relative positioning */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="border-b border-white/20 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <LogoWithText logoWidth={300} logoHeight={100} />
            </div>
            <div className="flex items-center">
              <NavigationMenu />
            </div>
          </div>
        </div>
      </nav>

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
                  className="text-white px-8 py-3 rounded-lg transition-colors font-medium text-lg text-center"
                  style={{ backgroundColor: '#2C4969' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1F3449'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2C4969'}
                >
                  Browse Journeys
                </Link>
                {user && (
                  <Link
                    href="/owner/dashboard"
                    className="border-2 px-8 py-3 rounded-lg transition-colors font-medium text-lg text-center"
                    style={{ borderColor: '#2C4969', color: '#2C4969' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F0F7'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    My Dashboard
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link
                  href="/auth/signup"
                  className="text-white px-8 py-3 rounded-lg transition-colors font-medium text-lg text-center"
                  style={{ backgroundColor: '#2C4969' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1F3449'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2C4969'}
                >
                  Get Started
                </Link>
                <Link
                  href="/auth/login"
                  className="border-2 px-8 py-3 rounded-lg transition-colors font-medium text-lg text-center"
                  style={{ borderColor: '#2C4969', color: '#2C4969' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F0F7'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Sign In
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
          <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8 border border-white/20">
            <div className="text-5xl mb-4">🚢</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">For Boat Owners & Skippers</h3>
            <p className="text-gray-600 mb-6">
              Need crew for your next voyage? Easily post your boat details and journey plans, 
              break them into legs, and find qualified crew members ready to join your adventure.
            </p>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start">
                <span className="mr-2" style={{ color: '#2C4969' }}>✓</span>
                <span>Register and manage your boats</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2" style={{ color: '#2C4969' }}>✓</span>
                <span>Plan journeys and divide into legs</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2" style={{ color: '#2C4969' }}>✓</span>
                <span>Review and approve crew applications</span>
              </li>
            </ul>
          </div>

          {/* For Crew */}
          <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8 border border-white/20">
            <div className="text-5xl mb-4">⛵</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">For Crew Members</h3>
            <p className="text-gray-600 mb-6">
              Looking for sailing opportunities? Browse available journeys, view detailed leg information, 
              and apply to join voyages that match your skills and interests.
            </p>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start">
                <span className="mr-2" style={{ color: '#2C4969' }}>✓</span>
                <span>Browse available journeys and legs</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2" style={{ color: '#2C4969' }}>✓</span>
                <span>Filter by location, dates, and skills</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2" style={{ color: '#2C4969' }}>✓</span>
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
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: '#2C4969' }}>
          <h3 className="text-3xl font-bold text-white mb-4">
            Ready to Start Your Adventure?
          </h3>
          <p className="text-blue-100 mb-8 text-lg max-w-2xl mx-auto">
            Join our community of boat owners and crew members today
          </p>
          <Link
            href={user ? '/owner/dashboard' : '/auth/signup'}
            className="bg-white px-8 py-3 rounded-lg transition-colors font-medium text-lg inline-block"
            style={{ color: '#2C4969' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F0F7'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            {user ? 'Go to Dashboard' : 'Get Started'}
          </Link>
        </div>
      </section>

        {/* Footer */}
        <footer className="border-t border-white/20 bg-white/90 backdrop-blur-md mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p className="mb-2">© 2024 Find My Crew. All rights reserved.</p>
            <p className="text-sm text-gray-500">
              Connecting boat owners with crew members worldwide
            </p>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
