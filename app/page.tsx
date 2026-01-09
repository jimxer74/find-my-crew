import React from 'react';

export default function Home() {
  return (
    <div 
      className="min-h-screen relative bg-cover bg-center bg-fixed"
      style={{
        backgroundImage: 'url(https://source.unsplash.com/1920x1080/?sailboat,boat)'
      }}
    >
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"></div>
      
      {/* Content wrapper with relative positioning */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="border-b border-white/20 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">⚓ Find My Crew</h1>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-blue-600 hover:text-blue-700 font-medium">
                Log In
              </button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                Sign Up
              </button>
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
            <button className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg">
              Browse Journeys
            </button>
            <button className="border-2 border-blue-600 text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors font-medium text-lg">
              Post a Journey
            </button>
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
                <span className="text-blue-600 mr-2">✓</span>
                <span>Register and manage your boats</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>Plan journeys and divide into legs</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
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
                <span className="text-blue-600 mr-2">✓</span>
                <span>Browse available journeys and legs</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>Filter by location, dates, and skills</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
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
        <div className="bg-blue-600 rounded-2xl p-12 text-center">
          <h3 className="text-3xl font-bold text-white mb-4">
            Ready to Start Your Adventure?
          </h3>
          <p className="text-blue-100 mb-8 text-lg max-w-2xl mx-auto">
            Join our community of boat owners and crew members today
          </p>
          <button className="bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors font-medium text-lg">
            Get Started
          </button>
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
