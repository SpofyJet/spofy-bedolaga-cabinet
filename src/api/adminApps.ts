import apiClient from './client';

export interface LocalizedText {
  en: string;
  ru: string;
  fr?: string;
}

export const adminAppsApi = {
  // Get Remnawave config status
  getRemnaWaveStatus: async (): Promise<{ enabled: boolean; config_uuid: string | null }> => {
    const response = await apiClient.get<{ enabled: boolean; config_uuid: string | null }>(
      '/cabinet/admin/apps/remnawave/status',
    );
    return response.data;
  },

  // Set Remnawave config UUID
  setRemnaWaveUuid: async (
    uuid: string | null,
  ): Promise<{ enabled: boolean; config_uuid: string | null }> => {
    const response = await apiClient.put<{ enabled: boolean; config_uuid: string | null }>(
      '/cabinet/admin/apps/remnawave/uuid',
      { uuid },
    );
    return response.data;
  },

  // List available Remnawave configs
  listRemnaWaveConfigs: async (): Promise<
    { uuid: string; name: string; view_position: number }[]
  > => {
    const response = await apiClient.get<{ uuid: string; name: string; view_position: number }[]>(
      '/cabinet/admin/apps/remnawave/configs',
    );
    return response.data;
  },
};

// ============== Remnawave Format Types ==============
