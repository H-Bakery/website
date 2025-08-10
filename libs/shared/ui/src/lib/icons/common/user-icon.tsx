import React from 'react'

/**
 * User icon component props
 * @interface UserIconProps
 */
export interface UserIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size (width and height) */
  size?: number
}

/**
 * User icon component
 *
 * A user/person icon for profile, authentication, and user-related UI elements
 *
 * @component
 * @example
 * ```tsx
 * // Default usage
 * <UserIcon />
 *
 * // Custom size and color
 * <UserIcon size={24} color="primary" />
 *
 * // With custom props
 * <UserIcon
 *   size={20}
 *   style={{ color: '#1976d2' }}
 *   aria-label="User profile"
 * />
 * ```
 */
export const UserIcon: React.FC<UserIconProps> = ({ size = 16, ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="User"
      {...props}
    >
      <g clipPath="url(#user-clip)">
        <path
          d="M5.38603 9.45454H10.6133C11.4629 9.45558 12.2774 9.79776 12.8782 10.406C13.4789 11.0143 13.8168 11.8389 13.8179 12.6991V16H2.1815V12.6991C2.18253 11.8389 2.52048 11.0143 3.12122 10.406C3.72196 9.79776 4.53645 9.45558 5.38603 9.45454V9.45454Z"
          fill="currentColor"
        />
        <path
          d="M8 8C5.79086 8 4 6.20914 4 4C4 1.79086 5.79086 0 8 0C10.2091 0 12 1.79086 12 4C12 6.20914 10.2091 8 8 8Z"
          fill="currentColor"
        />
      </g>
      <defs>
        <clipPath id="user-clip">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  )
}

export default UserIcon
