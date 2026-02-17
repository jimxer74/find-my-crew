'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

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

  if (!passportData) {
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

  const hasAnyData = passportData.passport_document_id || passportData.ai_score !== null || passportData.photo_file_data;
  const isPendingReview = hasAnyData && passportData.ai_score === null;

  return (
    <div className="space-y-6">
      {/* Pending Review Notice */}
      {isPendingReview && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-800">
                Passport Verification Pending: AI assessment is in progress. Please check back shortly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Manual Review Notice */}
      {passportData.ai_score && passportData.ai_score < 80 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-800">
                Manual Review Recommended: Please review the passport document and photo below to verify the applicant's identity.
              </p>
            </div>
          </div>
        </div>
      )}

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
            <div className="pt-3 border-t border-border">
              <Link
                href={`/documents/${passportDoc.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Passport Document
              </Link>
            </div>
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
              <div
                className="relative h-80 w-auto rounded-lg overflow-hidden bg-black/5 group cursor-pointer"
                onClick={() => setPhotoEnlarged(true)}
              >
                <img
                  src={passportData.photo_file_data?.startsWith('data:') ? passportData.photo_file_data : `data:image/jpeg;base64,${passportData.photo_file_data}`}
                  alt="Crew verification photo"
                  className="w-full h-auto max-h-80 object-contain"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} stroke="white" />
                  </svg>
                </div>
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
            <div className="relative flex items-center justify-center">
              <button
                onClick={() => setPhotoEnlarged(false)}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <img
                src={passportData.photo_file_data?.startsWith('data:') ? passportData.photo_file_data : `data:image/jpeg;base64,${passportData.photo_file_data}`}
                alt="Crew verification photo enlarged"
                className="w-auto h-[90vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
