'use client';

import { useState } from 'react';
import Image from 'next/image';

interface PassportVerificationSectionProps {
  passportData?: {
    passport_document_id: string | null;
    ai_score: number | null;
    ai_reasoning: string | null;
    photo_verification_passed: boolean | null;
    photo_confidence_score: number | null;
    photo_file_data: string | null; // base64
  } | null;
  passportDoc?: {
    id: string;
    file_name: string;
    metadata: {
      holder_name?: string;
      document_number?: string;
      issuing_country?: string;
      expiry_date?: string;
    };
  } | null;
}

/**
 * Component to display passport verification information and photos for manual review
 * Shows passport details, validity status, photo, and facial matching results
 */
export function PassportVerificationSection({
  passportData,
  passportDoc,
}: PassportVerificationSectionProps) {
  const [photoEnlarged, setPhotoEnlarged] = useState(false);

  if (!passportData || !passportDoc) {
    return null;
  }

  const getScoreBadgeColor = (score: number | null) => {
    if (score === null) return { bg: 'bg-gray-100', text: 'text-gray-700' };
    if (score >= 80) return { bg: 'bg-green-100', text: 'text-green-700' };
    if (score >= 60) return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
    return { bg: 'bg-red-100', text: 'text-red-700' };
  };

  const getStatusBadge = (passed: boolean | null) => {
    if (passed === null) return { label: 'Pending', bg: 'bg-gray-100', text: 'text-gray-700', passed: false };
    if (passed) return { label: 'Verified', bg: 'bg-green-100', text: 'text-green-700', passed: true };
    return { label: 'Not Verified', bg: 'bg-red-100', text: 'text-red-700', passed: false };
  };

  const passportStatus = getStatusBadge(passportData.photo_verification_passed);
  const scoreColors = getScoreBadgeColor(passportData.ai_score);

  return (
    <div className="space-y-6">
      {/* Passport Document Section */}
      {passportDoc && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Passport Document</h3>
          <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-2">
            {passportDoc.metadata?.holder_name && (
              <div className="flex justify-between items-start">
                <span className="text-xs text-muted-foreground">Holder Name</span>
                <span className="text-sm font-medium text-foreground">{passportDoc.metadata.holder_name}</span>
              </div>
            )}
            {passportDoc.metadata?.document_number && (
              <div className="flex justify-between items-start">
                <span className="text-xs text-muted-foreground">Document Number</span>
                <span className="text-sm font-medium text-foreground">{passportDoc.metadata.document_number}</span>
              </div>
            )}
            {passportDoc.metadata?.issuing_country && (
              <div className="flex justify-between items-start">
                <span className="text-xs text-muted-foreground">Issuing Country</span>
                <span className="text-sm font-medium text-foreground">{passportDoc.metadata.issuing_country}</span>
              </div>
            )}
            {passportDoc.metadata?.expiry_date && (
              <div className="flex justify-between items-start pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Expiry Date</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{passportDoc.metadata.expiry_date}</span>
                  {new Date(passportDoc.metadata.expiry_date) > new Date() ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Valid
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Expired
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Passport AI Validation */}
      {passportData.ai_score !== null && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">AI Validation</h3>
          <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Passport Validity</span>
              <div className={`px-2 py-1 rounded text-xs font-medium ${scoreColors.bg} ${scoreColors.text}`}>
                {passportData.ai_score}% Confidence
              </div>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  passportData.ai_score >= 80 ? 'bg-green-500' :
                  passportData.ai_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${passportData.ai_score}%` }}
              />
            </div>
            {passportData.ai_reasoning && (
              <p className="text-xs text-foreground bg-muted rounded p-2 mt-2">
                {passportData.ai_reasoning}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Photo Verification Section */}
      {passportData.photo_file_data && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Uploaded Photo</h3>
          <div className="bg-muted/30 border border-border rounded-lg p-4">
            <div className="space-y-3">
              {/* Photo Display */}
              <div className="relative w-full h-auto rounded-lg overflow-hidden bg-black/5">
                <img
                  src={passportData.photo_file_data}
                  alt="Crew verification photo"
                  className="w-full h-auto max-h-96 object-cover cursor-pointer"
                  onClick={() => setPhotoEnlarged(true)}
                />
              </div>

              {/* Photo Verification Status */}
              {passportData.photo_verification_passed !== null && (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">Facial Verification</span>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${passportStatus.bg} ${passportStatus.text}`}>
                      {passportStatus.passed ? (
                        <>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {passportStatus.label}
                        </>
                      ) : (
                        <>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          {passportStatus.label}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Photo Confidence Score */}
              {passportData.photo_confidence_score !== null && (
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Confidence</span>
                    <span className="text-xs font-medium text-foreground">
                      {Math.round(passportData.photo_confidence_score * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        passportData.photo_confidence_score >= 0.8 ? 'bg-green-500' :
                        passportData.photo_confidence_score >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${passportData.photo_confidence_score * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Photo Modal */}
      {photoEnlarged && passportData.photo_file_data && (
        <>
          <div
            className="fixed inset-0 bg-black/75 z-50"
            onClick={() => setPhotoEnlarged(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative bg-black rounded-lg max-w-2xl w-full">
              <button
                onClick={() => setPhotoEnlarged(false)}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <img
                src={passportData.photo_file_data}
                alt="Crew verification photo enlarged"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
