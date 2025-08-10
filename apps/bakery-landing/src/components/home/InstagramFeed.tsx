'use client'
import React, { useState } from 'react'
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  IconButton,
  useTheme,
  useMediaQuery,
  Skeleton,
} from '@mui/material'
import { keyframes } from '@mui/system'
import InstagramIcon from '@mui/icons-material/Instagram'
import FavoriteIcon from '@mui/icons-material/Favorite'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import Image from 'next/image'

// Animation keyframes
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`

const heartBeat = keyframes`
  0% {
    transform: scale(1);
  }
  14% {
    transform: scale(1.3);
  }
  28% {
    transform: scale(1);
  }
  42% {
    transform: scale(1.3);
  }
  70% {
    transform: scale(1);
  }
`

// Mock Instagram posts data
const instagramPosts = [
  {
    id: 1,
    image: '/assets/images/instagram/post1.jpg',
    caption: 'Frisch aus dem Ofen! 🥖✨ #bäckereiheusser #frischgebacken',
    likes: 124,
    comments: 8,
    link: 'https://www.instagram.com/p/mock1',
  },
  {
    id: 2,
    image: '/assets/images/instagram/post2.jpg',
    caption: 'Unsere beliebten Croissants - jeden Morgen frisch! 🥐 #handwerk',
    likes: 256,
    comments: 15,
    link: 'https://www.instagram.com/p/mock2',
  },
  {
    id: 3,
    image: '/assets/images/instagram/post3.jpg',
    caption: 'Neue Kreation: Himbeer-Sahne-Torte 🍰❤️ #konditorei',
    likes: 342,
    comments: 23,
    link: 'https://www.instagram.com/p/mock3',
  },
  {
    id: 4,
    image: '/assets/images/instagram/post4.jpg',
    caption: 'Traditionelles Bauernbrot - wie früher! 🍞 #tradition',
    likes: 189,
    comments: 12,
    link: 'https://www.instagram.com/p/mock4',
  },
  {
    id: 5,
    image: '/assets/images/instagram/post5.jpg',
    caption: 'Oster-Special: Unsere bunten Ostereier 🥚🐰 #ostern',
    likes: 298,
    comments: 19,
    link: 'https://www.instagram.com/p/mock5',
  },
  {
    id: 6,
    image: '/assets/images/instagram/post6.jpg',
    caption: 'Team bei der Arbeit! 👨‍🍳👩‍🍳 #teamwork #bäckerei',
    likes: 412,
    comments: 31,
    link: 'https://www.instagram.com/p/mock6',
  },
]

const InstagramFeed: React.FC = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [imageLoading, setImageLoading] = useState<{ [key: number]: boolean }>(
    instagramPosts.reduce((acc, post) => ({ ...acc, [post.id]: true }), {})
  )
  const [imageErrors, setImageErrors] = useState<{ [key: number]: boolean }>(
    instagramPosts.reduce((acc, post) => ({ ...acc, [post.id]: false }), {})
  )
  const [likedPosts, setLikedPosts] = useState<number[]>([])

  const handleImageLoad = (postId: number) => {
    setImageLoading((prev) => ({ ...prev, [postId]: false }))
  }

  const handleImageError = (postId: number) => {
    setImageLoading((prev) => ({ ...prev, [postId]: false }))
    setImageErrors((prev) => ({ ...prev, [postId]: true }))
  }

  const handleLike = (postId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setLikedPosts((prev) =>
      prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId]
    )
  }

  const displayPosts = isMobile ? instagramPosts.slice(0, 4) : instagramPosts

  return (
    <Box
      sx={{
        py: 8,
        backgroundColor: 'background.default',
        position: 'relative',
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              mb: 2,
            }}
          >
            <InstagramIcon
              sx={{
                fontSize: 40,
                background: 'linear-gradient(45deg, #833AB4, #FD1D1D, #FCAF45)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            />
            <Typography
              variant="overline"
              sx={{
                fontWeight: 'bold',
                letterSpacing: 2,
                fontSize: '0.9rem',
                background: 'linear-gradient(45deg, #833AB4, #FD1D1D, #FCAF45)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              @baeckereiheusser
            </Typography>
          </Box>

          <Typography
            variant="h3"
            component="h2"
            gutterBottom
            sx={{
              fontWeight: 'bold',
              fontSize: { xs: '2rem', md: '2.5rem' },
            }}
          >
            Folgen Sie uns auf Instagram
          </Typography>

          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ maxWidth: 600, mx: 'auto' }}
          >
            Entdecken Sie täglich neue Einblicke in unsere Backstube und lassen
            Sie sich inspirieren
          </Typography>
        </Box>

        {/* Instagram Grid */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {displayPosts.map((post, index) => (
            <Grid item xs={6} sm={4} md={4} lg={2} key={post.id}>
              <Box
                component="a"
                href={post.link}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: 'block',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    position: 'relative',
                    paddingTop: '100%',
                    overflow: 'hidden',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    animation: `${fadeIn} 0.6s ease-out ${index * 0.1}s both`,
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'scale(1.05)',
                      boxShadow: 4,
                      '& .overlay': {
                        opacity: 1,
                      },
                      '& .engagement': {
                        transform: 'translateY(0)',
                      },
                    },
                  }}
                >
                  {/* Loading Skeleton */}
                  {imageLoading[post.id] && (
                    <Skeleton
                      variant="rectangular"
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                      }}
                    />
                  )}

                  {/* Actual Image - only try to load if no error */}
                  {!imageErrors[post.id] && (
                    <Box
                      component="img"
                      src={post.image}
                      alt={post.caption}
                      onLoad={() => handleImageLoad(post.id)}
                      onError={() => handleImageError(post.id)}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: imageLoading[post.id] ? 0 : 1,
                        transition: 'opacity 0.3s ease',
                      }}
                    />
                  )}

                  {/* Fallback gradient background - show when image errors or is loading */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      background: [
                        'linear-gradient(135deg, #833AB4 0%, #FD1D1D 50%, #FCAF45 100%)',
                        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                        'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
                        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                      ][post.id % 6],
                      display:
                        imageLoading[post.id] || imageErrors[post.id]
                          ? 'block'
                          : 'none',
                    }}
                  />

                  {/* Instagram Icon for fallback */}
                  <InstagramIcon
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: 60,
                      color: 'white',
                      opacity: 0.3,
                      display:
                        imageLoading[post.id] || imageErrors[post.id]
                          ? 'block'
                          : 'none',
                    }}
                  />

                  {/* Hover Overlay */}
                  <Box
                    className="overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.3s ease',
                    }}
                  >
                    {/* Engagement Stats */}
                    <Box
                      className="engagement"
                      sx={{
                        display: 'flex',
                        gap: 3,
                        color: 'white',
                        transform: 'translateY(20px)',
                        transition: 'transform 0.3s ease',
                      }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        <IconButton
                          size="small"
                          onClick={(e) => handleLike(post.id, e)}
                          sx={{
                            color: 'white',
                            p: 0,
                            '&:hover': {
                              backgroundColor: 'transparent',
                            },
                          }}
                        >
                          <FavoriteIcon
                            sx={{
                              fontSize: 20,
                              color: likedPosts.includes(post.id)
                                ? 'error.main'
                                : 'white',
                              animation: likedPosts.includes(post.id)
                                ? `${heartBeat} 0.8s ease`
                                : 'none',
                            }}
                          />
                        </IconButton>
                        <Typography variant="body2">
                          {likedPosts.includes(post.id)
                            ? post.likes + 1
                            : post.likes}
                        </Typography>
                      </Box>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        <ChatBubbleOutlineIcon sx={{ fontSize: 20 }} />
                        <Typography variant="body2">{post.comments}</Typography>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* CTA Section */}
        <Box
          sx={{
            textAlign: 'center',
            p: 4,
            backgroundColor: 'background.paper',
            borderRadius: 3,
            border: '2px solid',
            borderColor: 'primary.main',
          }}
        >
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'medium' }}>
            Werden Sie Teil unserer Community
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Über 1.500 Follower vertrauen uns bereits
          </Typography>
          <Box
            component="a"
            href="https://www.instagram.com/baeckereiheusser"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 4,
              py: 1.5,
              backgroundColor: 'primary.main',
              color: 'white',
              borderRadius: '30px',
              textDecoration: 'none',
              fontWeight: 600,
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: 'primary.dark',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(208, 56, 186, 0.35)',
              },
            }}
          >
            <InstagramIcon />
            Folgen Sie uns
          </Box>
        </Box>
      </Container>
    </Box>
  )
}

export default InstagramFeed
