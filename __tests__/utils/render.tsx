import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { AuthProvider } from '@/app/contexts/AuthContext';
import { FilterProvider } from '@/app/contexts/FilterContext';

type AllTheProvidersProps = {
  children: React.ReactNode;
};

function AllTheProviders({ children }: AllTheProvidersProps) {
  return (
    <AuthProvider>
      <FilterProvider>
        {children}
      </FilterProvider>
    </AuthProvider>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {}

const customRender = (
  ui: ReactElement,
  renderOptions: CustomRenderOptions = {}
) => {
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
};

export * from '@testing-library/react';
export { customRender as render };
