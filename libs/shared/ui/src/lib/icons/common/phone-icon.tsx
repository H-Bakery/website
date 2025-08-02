import React from 'react'

/**
 * Phone icon component props
 * @interface PhoneIconProps
 */
export interface PhoneIconProps extends React.SVGProps<SVGSVGElement> {
  /** Icon size (width and height) */
  size?: number
}

/**
 * Phone icon component
 *
 * A telephone/phone icon for contact information and communication
 *
 * @component
 * @example
 * ```tsx
 * // Default usage
 * <PhoneIcon />
 *
 * // Custom size and color
 * <PhoneIcon size={24} color="primary" />
 *
 * // With custom props
 * <PhoneIcon
 *   size={20}
 *   style={{ color: '#1976d2' }}
 *   aria-label="Call us"
 * />
 * ```
 */
export const PhoneIcon: React.FC<PhoneIconProps> = ({
  size = 16,
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Phone"
      {...props}
    >
      <g clipPath="url(#phone-clip)">
        <path
          d="M15.5804 11.7424L13.3429 9.50953C12.5438 8.71208 11.1853 9.03109 10.8656 10.0677C10.6259 10.7855 9.82675 11.1842 9.10754 11.0247C7.50929 10.626 5.35166 8.55259 4.95209 6.87796C4.71236 6.16023 5.19183 5.36278 5.91104 5.12358C6.9499 4.8046 7.26955 3.44895 6.47043 2.6515L4.23288 0.418658C3.59358 -0.139553 2.63464 -0.139553 2.07525 0.418658L0.556915 1.9338C-0.96142 3.52869 0.71674 7.75515 4.47262 11.5031C8.2285 15.2511 12.4639 17.0055 14.0621 15.4106L15.5804 13.8955C16.1399 13.2575 16.1399 12.3006 15.5804 11.7424Z"
          fill="currentColor"
        />
      </g>
      <defs>
        <clipPath id="phone-clip">
          <rect width="16" height="16" fill="currentColor" />
        </clipPath>
      </defs>
    </svg>
  )
}

export default PhoneIcon
