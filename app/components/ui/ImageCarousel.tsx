'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';
import { Button } from './Button/Button';


interface ImageCarouselProps {
  images: string[];
  alt?: string;
  className?: string;
  showThumbnails?: boolean;
  showDots?: boolean;           // Show dots indicator (default: true)
  showArrows?: boolean;         // Show arrows on desktop (default: true, hidden on mobile)
  height?: string;              // Configurable height (default: 'h-60')
  autoPlay?: boolean;
  autoPlayInterval?: number;
  initialIndex?: number;
  onImageChange?: (index: number) => void;
}

export function ImageCarousel({
  images,
  alt = 'Journey image',
  className = '',
  showThumbnails = false,
  showDots = true,
  showArrows = true,
  height = 'h-60',
  autoPlay = false,
  autoPlayInterval = 5000,
  initialIndex = 0,
  onImageChange
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isAutoPlaying, setIsAutoPlaying] = useState(autoPlay);

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying || images.length <= 1) return;

    const interval = setInterval(() => {
      nextImage();
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [currentIndex, isAutoPlaying, autoPlayInterval, images.length]);

  // Reset current index when images change
  useEffect(() => {
    if (initialIndex >= 0 && initialIndex < images.length) {
      setCurrentIndex(initialIndex);
    } else if (images.length > 0) {
      setCurrentIndex(0);
    }
  }, [images.length, initialIndex]);

  const nextImage = () => {
    const newIndex = (currentIndex + 1) % images.length;
    setCurrentIndex(newIndex);
    onImageChange?.(newIndex);
  };

  const prevImage = () => {
    const newIndex = (currentIndex - 1 + images.length) % images.length;
    setCurrentIndex(newIndex);
    onImageChange?.(newIndex);
  };

  const goToImage = (index: number) => {
    setCurrentIndex(index);
    onImageChange?.(index);
  };

  if (images.length === 0) {
    return (
      <div className={`bg-muted rounded-lg flex items-center justify-center ${height} ${className}`}>
        <p className="text-sm text-muted-foreground">No images available</p>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  const handlers = useSwipeable({
    onSwipedLeft: nextImage,
    onSwipedRight: prevImage,
    trackMouse: false,           // Disable mouse drag for cleaner UX
    trackTouch: true,            // Enable touch swipe
    delta: 35,                   // sensitivity
    preventScrollOnSwipe: true,
  });


  return (
    <div className={`relative group ${className}`} {...handlers}>
      {/* Image Container */}
      <div className={`relative w-full ${height} overflow-hidden`}>
        <Image
          src={currentImage}
          alt={`${alt} ${currentIndex + 1}`}
          fill
          className="object-cover"
          style={{
            objectPosition: 'bottom',
          }}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={currentIndex === 0}
          quality={85}
        />

        {/* Navigation Arrows - Desktop only */}
        {showArrows && images.length > 1 && (
          <>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                prevImage();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 !bg-black/50 !text-white !p-2 !rounded-full opacity-0 group-hover:opacity-100 transition-all hover:!bg-black/75 hidden md:flex !flex-shrink-0"
              variant="ghost"
              size="sm"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 !bg-black/50 !text-white !p-2 !rounded-full opacity-0 group-hover:opacity-100 transition-all hover:!bg-black/75 hidden md:flex !flex-shrink-0"
              variant="ghost"
              size="sm"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </>
        )}

        {/* Dots Indicator - Centered at bottom */}
        {showDots && images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-white'
                    : 'bg-white/50'
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails (optional) */}
      {showThumbnails && images.length > 1 && (
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <Button
              key={index}
              onClick={() => goToImage(index)}
              className={`!flex-shrink-0 relative w-20 h-16 !rounded-md overflow-hidden border-2 transition-all !p-0 ${
                index === currentIndex ? 'border-primary' : 'border-transparent hover:border-muted'
              }`}
              variant="ghost"
              aria-label={`View image ${index + 1}`}
            >
              <Image
                src={image}
                alt={`${alt} ${index + 1}`}
                fill
                className="object-cover"
                style={{
                  objectPosition: 'bottom',
                }}
                sizes="80px"
                quality={50}
              />
              {index === currentIndex && (
                <div className="absolute inset-0 bg-primary/20 rounded-md" />
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
