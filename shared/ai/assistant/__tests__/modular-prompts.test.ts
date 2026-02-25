/**
 * Modular Prompts Tests
 */

import { describe, it, expect } from 'vitest';
import { ModularPromptBuilder, UseCaseIntent } from '../modular-prompts';

describe('ModularPromptBuilder', () => {
  let promptBuilder: ModularPromptBuilder;

  beforeEach(() => {
    promptBuilder = new ModularPromptBuilder();
  });

  describe('buildPrompt', () => {
    const mockContext = {
      userId: 'user-123',
      profile: {
        username: 'sailor_john',
        sailingExperience: 3,
        skills: ['navigation', 'cooking'],
        certifications: 'RYA Yachtmaster',
        riskLevel: ['Offshore sailing'],
        sailingPreferences: 'Long-distance passages',
        userDescription: 'Experienced sailor looking for offshore adventures',
        roles: ['crew']
      },
      boats: [
        { id: 'boat-1', name: 'Sea Breeze', type: 'Sailing yacht' }
      ],
      recentRegistrations: [
        { id: 'reg-1', legId: 'leg-1', legName: 'Mediterranean Adventure', journeyName: 'Summer Cruise', status: 'pending' }
      ],
      pendingActionsCount: 2,
      suggestionsCount: 1
    };

    it('should build crew search sailing trips prompt', () => {
      const prompt = promptBuilder.buildPrompt(UseCaseIntent.CREW_SEARCH_SAILING_TRIPS, mockContext);

      expect(prompt).toContain('crew sailing trip finder specialist');
      expect(prompt).toContain('Crew Profile: sailor_john');
      expect(prompt).toContain('Experience Level: Coastal Skipper');
      expect(prompt).toContain('Skills: navigation, cooking');
      expect(prompt).toContain('Certifications: RYA Yachtmaster');
      expect(prompt).toContain('Recent Activity: 1 recent registrations as crew');
      expect(prompt).toContain('Available tools for this use case:');
      expect(prompt).toContain('search_legs_by_location - Primary tool for location-based searches');
      expect(prompt).toContain('Present results in a clear, actionable format');
    });

    it('should build crew improve profile prompt', () => {
      const prompt = promptBuilder.buildPrompt(UseCaseIntent.CREW_IMPROVE_PROFILE, mockContext);

      expect(prompt).toContain('crew profile optimization specialist');
      expect(prompt).toContain('Current Crew Profile Status:');
      expect(prompt).toContain('User Description: Experienced sailor looking for offshore adventures');
      expect(prompt).toContain('Certifications: RYA Yachtmaster');
      expect(prompt).toContain('Crew Profile Completeness Analysis:');
      expect(prompt).toContain('Available tools for this use case:');
      expect(prompt).toContain('suggest_profile_update_user_description');
      expect(prompt).toContain('Provide specific, actionable suggestions');
    });

    it('should build crew register prompt', () => {
      const prompt = promptBuilder.buildPrompt(UseCaseIntent.CREW_REGISTER, mockContext);

      expect(prompt).toContain('crew registration specialist');
      expect(prompt).toContain('Crew Qualifications:');
      expect(prompt).toContain('Experience Level: Coastal Skipper');
      expect(prompt).toContain('Recent Registration Activity:');
      expect(prompt).toContain('Available tools for this use case:');
      expect(prompt).toContain('suggest_register_for_leg');
      expect(prompt).toContain('Provide clear guidance on registration opportunities');
    });

    it('should build general conversation prompt', () => {
      const prompt = promptBuilder.buildPrompt(UseCaseIntent.GENERAL_CONVERSATION, mockContext);

      expect(prompt).toContain('general AI assistant for SailSmart');
      expect(prompt).toContain('User Roles: crew');
      expect(prompt).toContain('Available Platform Features:');
      expect(prompt).toContain('Available tools for this use case:');
      expect(prompt).toContain('get_user_profile');
      expect(prompt).toContain('Provide clear, concise answers');
    });

    it('should handle context without profile', () => {
      const contextWithoutProfile = {
        ...mockContext,
        profile: null
      };

      const prompt = promptBuilder.buildPrompt(UseCaseIntent.CREW_SEARCH_SAILING_TRIPS, contextWithoutProfile);
      expect(prompt).toContain('You are a crew sailing trip finder specialist');
      expect(prompt).not.toContain('Crew Profile:');
    });

    it('should handle context without recent registrations', () => {
      const contextWithoutRegistrations = {
        ...mockContext,
        recentRegistrations: []
      };

      const prompt = promptBuilder.buildPrompt(UseCaseIntent.CREW_SEARCH_SAILING_TRIPS, contextWithoutRegistrations);
      expect(prompt).toContain('crew sailing trip finder specialist');
      expect(prompt).not.toContain('Recent Activity:');
    });
  });

  describe('getExperienceLevelName', () => {
    it('should return correct experience level names', () => {
      const promptBuilderInstance = new (class extends ModularPromptBuilder {
        getExperienceLevelName(level: number): string {
          return super['getExperienceLevelName'](level);
        }
      })();

      expect(promptBuilderInstance.getExperienceLevelName(1)).toBe('Beginner');
      expect(promptBuilderInstance.getExperienceLevelName(2)).toBe('Competent Crew');
      expect(promptBuilderInstance.getExperienceLevelName(3)).toBe('Coastal Skipper');
      expect(promptBuilderInstance.getExperienceLevelName(4)).toBe('Offshore Skipper');
      expect(promptBuilderInstance.getExperienceLevelName(5)).toBe('Unknown');
    });
  });

  describe('getProfileCompleteness', () => {
    it('should calculate profile completeness correctly', () => {
      const promptBuilderInstance = new (class extends ModularPromptBuilder {
        getProfileCompleteness(profile: any): number {
          return super['getProfileCompleteness'](profile);
        }
      })();

      const completeProfile = {
        userDescription: 'Test',
        skills: ['test'],
        certifications: 'test',
        sailingExperience: 3,
        riskLevel: ['test'],
        sailingPreferences: 'test'
      };

      const incompleteProfile = {
        userDescription: 'Test',
        skills: ['test'],
        sailingExperience: 3
      };

      expect(promptBuilderInstance.getProfileCompleteness(completeProfile)).toBe(6);
      expect(promptBuilderInstance.getProfileCompleteness(incompleteProfile)).toBe(3);
    });
  });

  describe('getMissingFields', () => {
    it('should identify missing profile fields', () => {
      const promptBuilderInstance = new (class extends ModularPromptBuilder {
        getMissingFields(profile: any): string[] {
          return super['getMissingFields'](profile);
        }
      })();

      const profile = {
        userDescription: 'Test',
        sailingExperience: 3
      };

      const missing = promptBuilderInstance.getMissingFields(profile);
      expect(missing).toContain('Certifications');
      expect(missing).toContain('Skills');
      expect(missing).toContain('Risk Level');
      expect(missing).toContain('Sailing Preferences');
    });
  });

  describe('identifySkillGaps', () => {
    it('should identify skill gaps correctly', () => {
      const promptBuilderInstance = new (class extends ModularPromptBuilder {
        identifySkillGaps(profile: any): string[] {
          return super['identifySkillGaps'](profile);
        }
      })();

      const beginnerProfile = {
        sailingExperience: 1,
        skills: [],
        certifications: null
      };

      const intermediateProfile = {
        sailingExperience: 3,
        skills: ['navigation'],
        certifications: 'RYA Yachtmaster'
      };

      const beginnerGaps = promptBuilderInstance.identifySkillGaps(beginnerProfile);
      const intermediateGaps = promptBuilderInstance.identifySkillGaps(intermediateProfile);

      expect(beginnerGaps).toContain('Basic sailing skills');
      expect(beginnerGaps).toContain('Advanced sailing certifications');
      expect(intermediateGaps).toHaveLength(0);
    });
  });
});