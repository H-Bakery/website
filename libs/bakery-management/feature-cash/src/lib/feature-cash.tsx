import styles from './feature-cash.module.css'

/* eslint-disable-next-line */
export interface FeatureCashProps {}

export function FeatureCash(props: FeatureCashProps) {
  return (
    <div className={styles['container']}>
      <h1>Welcome to FeatureCash!</h1>
    </div>
  )
}

export default FeatureCash
