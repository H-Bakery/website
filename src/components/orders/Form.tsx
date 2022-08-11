import { Box, Button, Container, Typography } from "@mui/material";
import React from "react";
import emailjs from "@emailjs/browser";
import Input from "../Input";
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import EmailRoundedIcon from '@mui/icons-material/EmailRounded'
import ChatRoundedIcon from '@mui/icons-material/ChatRounded'

interface Props {}

const INPUTS = [
  {
    label: 'Name',
    placeholder: 'Name',
    name: 'user_name',
    type: 'text',
    icon: <PersonRoundedIcon />
  },
  {
    label: 'Email',
    placeholder: 'Email',
    name: 'user_email',
    type: 'email',
    icon: <EmailRoundedIcon />
  },
  {
    label: 'Bestellung',
    placeholder: 'Zum Beispiel: 1 Weisbrot, 3 Doppelweck',
    name: 'message',
    type: 'text',
    icon: <ChatRoundedIcon />,
    multiline: true
  },
]

const OrderForm: React.FC<Props> = (props) => {
  const form = React.useRef<HTMLFormElement | string>("null");
  const [loading, setLoading] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  
  const sendEmail = (e: any) => {
    e.preventDefault();
    setLoading(true);
    emailjs
    .sendForm(
        "service_fqlqhhr",
        "template_bcbu0nt",
        form.current,
        "Tko9wdH-vfOzIrqHI"
        )
        .then(
            (result) => {
                setShowSuccess(true)
                console.log(result.text);
                setLoading(false);
                /* @ts-ignore */
                form.current.reset();
        },
        (error) => {
          console.log(error.text);
          setLoading(false);
        }
      );
  }

  return (
    <Box sx={styles.container}>
        <Typography variant="h4">Online bestellen</Typography>

        {showSuccess && (
          <Box sx={styles.success}>
            <Typography variant="body1" mb={2}>
              Vielen Dank für deine Bestellung!
            </Typography>
            <Button onClick={() => setShowSuccess(false) } color='inherit' variant='contained'>
              Noch etwas bestellen
            </Button>
          </Box>
        )}

        {!showSuccess && (
          <Box sx={{ mb: 6 }}>
            <Typography variant="body2" color='text.secondary' mb={2}>
              Du kannst auch gerne online bestellen und deine Bestellung einfach
              bei uns abholen. Fülle einfach das Bestellformular aus und wir
              senden dir umgehend eine Nachricht sobald die Bestellung bereit
              steht.
            </Typography>
            {/* @ts-ignore */}
            <form ref={form} onSubmit={sendEmail}>
              {INPUTS.map((item) => (
                <Input 
                  label={item.label}
                  placeholder={item.placeholder}
                  type={item.type}
                  name={item.name}
                  fullWidth
                  InputProps={{
                    startAdornment: item.icon
                  }}
                  multiline={!!item.multiline}
                  minRows={3}
                />
              ))}
              <Button disabled={loading} type="submit" variant='contained'>
                Bestellen
              </Button>
            </form>
          </Box>
        )}
    </Box>
  );
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    width: '100%'
  },
  success: {
    mt: 2,
    p: 2,
    boxShadow: 1,
    width: '100%',
    bgcolor: 'background.paper',
    borderRadius: '8px'
  }
}

export default OrderForm;
