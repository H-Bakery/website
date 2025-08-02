import styles from './feature-recipes.module.css'

/* eslint-disable-next-line */
export interface FeatureRecipesProps {}

export function FeatureRecipes(props: FeatureRecipesProps) {
  return (
    <div className={styles['container']}>
      <h1>Welcome to FeatureRecipes!</h1>
    </div>
  )
}

export default FeatureRecipes
