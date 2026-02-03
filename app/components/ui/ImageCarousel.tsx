'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';

interface ImageCarouselProps {
  images: string[];
  alt?: string;
  className?: string;
  showThumbnails?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  initialIndex?: number;
  onImageChange?: (index: number) => void;
}

export function ImageCarousel({
  images,
  alt = 'Journey image',
  className = '',
  showThumbnails = true,
  autoPlay = false,
  autoPlayInterval = 5000,
  initialIndex = 0,
  onImageChange
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    setCurrentIndex((prev) => (prev + 1) % images.length);
    onImageChange?.(currentIndex + 1 >= images.length ? 0 : currentIndex + 1);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    onImageChange?.(currentIndex - 1 < 0 ? images.length - 1 : currentIndex - 1);
  };

  const goToImage = (index: number) => {
    setCurrentIndex(index);
    onImageChange?.(index);
  };

  const openModal = () => {
    setIsModalOpen(true);
    setIsAutoPlaying(false); // Pause auto-play when modal opens
  };

  const closeModal = () => {
    setIsModalOpen(false);
    if (autoPlay) {
      setIsAutoPlaying(true); // Resume auto-play when modal closes
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) {
        switch (e.key) {
          case 'Escape':
            closeModal();
            break;
          case 'ArrowRight':
            nextImage();
            break;
          case 'ArrowLeft':
            prevImage();
            break;
        }
      } else {
        switch (e.key) {
          case 'ArrowRight':
            nextImage();
            break;
          case 'ArrowLeft':
            prevImage();
            break;
          case 'Enter':
          case ' ':
            if (images.length > 0) openModal();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isModalOpen, images.length]);

  if (images.length === 0) {
    return (
      <div className={`bg-muted rounded-lg flex items-center justify-center ${className}`}>
        <p className="text-sm text-muted-foreground">No images available</p>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <>
      {/* Main Carousel */}
      <div className={`relative group ${className}`}>
        {/* Image Container */}
        <div
          //className="relative w-full h-64 sm:h-80 md:h-96 overflow-hidden cursor-pointer"
          className="relative w-full h-60 overflow-hidden"
          onClick={images.length > 1 ? openModal : undefined}
        >
          <Image
            src={currentImage}
            alt={`${alt} ${currentIndex + 1}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            style={{
              objectPosition: 'bottom',
              transformOrigin: 'bottom center',
            } as React.CSSProperties}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            priority={currentIndex === 0}
            quality={85}
          />

          {/* Overlay for single image */}
          {/*}
          {images.length === 1 && (
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ZoomIn className="w-8 h-8 text-white" />
            </div>
          )}*/}

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-black/75"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-black/75"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            {currentIndex + 1} / {images.length}
          </div>
        )}

        {/* Thumbnails */}
        {showThumbnails && images.length > 1 && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => goToImage(index)}
                className={`flex-shrink-0 relative w-20 h-16 rounded-md overflow-hidden border-2 transition-all ${
                  index === currentIndex ? 'border-primary' : 'border-transparent hover:border-muted'
                }`}
                aria-label={`View image ${index + 1}`}
              >
                <Image
                  src={image}
                  alt={`${alt} ${index + 1}`}
                  fill
                  className="object-cover"
                  style={{
                    objectPosition: 'bottom',
                    transformOrigin: 'bottom center',
                  } as React.CSSProperties}
                  sizes="80px"
                  quality={50}
                />
                {index === currentIndex && (
                  <div className="absolute inset-0 bg-primary/20 rounded-md" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal View */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            {/* Close Button */}
            <button
              onClick={closeModal}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Navigation Arrows in Modal */}
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-black/75 transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-black/75 transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-8 h-8" />
            </button>

            {/* Main Image in Modal */}
            <div className="flex items-center justify-center">
              <Image
                src={currentImage}
                alt={`${alt} ${currentIndex + 1}`}
                width={1200}
                height={800}
                className="max-h-[90vh] object-contain"
                quality={90}
              />
            </div>

            {/* Thumbnail Navigation in Modal */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto pb-2">
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => goToImage(index)}
                    className={`flex-shrink-0 relative w-16 h-12 rounded overflow-hidden border-2 transition-all ${
                      index === currentIndex ? 'border-white' : 'border-transparent hover:border-gray-400'
                    }`}
                    aria-label={`View image ${index + 1}`}
                  >
                    <Image
                      src={image}
                      alt={`${alt} ${index + 1}`}
                      fill
                      className="object-cover"
                      style={{
                        objectPosition: 'bottom',
                        transformOrigin: 'bottom center',
                      } as React.CSSProperties}
                      sizes="64px"
                      quality={30}
                    />
                    {index === currentIndex && (
                      <div className="absolute inset-0 bg-white/20 rounded" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}